// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title EscrowContract
 * @dev Smart contract for managing ride escrow payments on BlockDAG network
 */
contract EscrowContract is ReentrancyGuard, Ownable, Pausable {
    
    enum EscrowStatus {
        Active,
        Released,
        Refunded,
        Disputed
    }
    
    struct Escrow {
        string rideId;
        address driver;
        address passenger;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    mapping(uint256 => Escrow) public escrows;
    mapping(string => uint256) public rideToEscrow;
    uint256 public nextEscrowId = 1;
    
    // Fee configuration
    uint256 public platformFeePercent = 250; // 2.5% (250 basis points)
    address public feeRecipient;
    
    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        string indexed rideId,
        address indexed driver,
        address passenger,
        uint256 amount
    );
    
    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed driver,
        uint256 amount,
        uint256 platformFee
    );
    
    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed passenger,
        uint256 amount
    );
    
    event EscrowDisputed(
        uint256 indexed escrowId,
        address indexed initiator
    );
    
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Create a new escrow for a ride
     * @param rideId Unique identifier for the ride
     * @param driver Address of the driver
     * @param passenger Address of the passenger
     * @param amount Amount to be escrowed
     */
    function createEscrow(
        string memory rideId,
        address driver,
        address passenger,
        uint256 amount
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(bytes(rideId).length > 0, "Invalid ride ID");
        require(driver != address(0), "Invalid driver address");
        require(passenger != address(0), "Invalid passenger address");
        require(driver != passenger, "Driver and passenger cannot be the same");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value == amount, "Sent value must equal escrow amount");
        require(rideToEscrow[rideId] == 0, "Escrow already exists for this ride");
        
        uint256 escrowId = nextEscrowId++;
        
        escrows[escrowId] = Escrow({
            rideId: rideId,
            driver: driver,
            passenger: passenger,
            amount: amount,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        rideToEscrow[rideId] = escrowId;
        
        emit EscrowCreated(escrowId, rideId, driver, passenger, amount);
        
        return escrowId;
    }
    
    /**
     * @dev Release escrow to driver (called when ride is completed)
     * @param escrowId ID of the escrow to release
     */
    function releaseEscrow(uint256 escrowId) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.amount > 0, "Escrow does not exist");
        require(escrow.status == EscrowStatus.Active, "Escrow is not active");
        require(
            msg.sender == escrow.passenger || msg.sender == owner(),
            "Only passenger or owner can release escrow"
        );
        
        escrow.status = EscrowStatus.Released;
        escrow.updatedAt = block.timestamp;
        
        uint256 platformFee = (escrow.amount * platformFeePercent) / 10000;
        uint256 driverAmount = escrow.amount - platformFee;
        
        // Transfer platform fee
        if (platformFee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: platformFee}("");
            require(feeSuccess, "Platform fee transfer failed");
        }
        
        // Transfer remaining amount to driver
        (bool driverSuccess, ) = escrow.driver.call{value: driverAmount}("");
        require(driverSuccess, "Driver payment failed");
        
        emit EscrowReleased(escrowId, escrow.driver, driverAmount, platformFee);
    }
    
    /**
     * @dev Refund escrow to passenger (called when ride is cancelled)
     * @param escrowId ID of the escrow to refund
     */
    function refundEscrow(uint256 escrowId) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.amount > 0, "Escrow does not exist");
        require(escrow.status == EscrowStatus.Active, "Escrow is not active");
        require(
            msg.sender == escrow.driver || msg.sender == owner(),
            "Only driver or owner can refund escrow"
        );
        
        escrow.status = EscrowStatus.Refunded;
        escrow.updatedAt = block.timestamp;
        
        // Refund full amount to passenger
        (bool success, ) = escrow.passenger.call{value: escrow.amount}("");
        require(success, "Refund failed");
        
        emit EscrowRefunded(escrowId, escrow.passenger, escrow.amount);
    }
    
    /**
     * @dev Initiate dispute for an escrow
     * @param escrowId ID of the escrow to dispute
     */
    function disputeEscrow(uint256 escrowId) external whenNotPaused {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.amount > 0, "Escrow does not exist");
        require(escrow.status == EscrowStatus.Active, "Escrow is not active");
        require(
            msg.sender == escrow.driver || msg.sender == escrow.passenger,
            "Only driver or passenger can dispute"
        );
        
        escrow.status = EscrowStatus.Disputed;
        escrow.updatedAt = block.timestamp;
        
        emit EscrowDisputed(escrowId, msg.sender);
    }
    
    /**
     * @dev Resolve dispute (owner only)
     * @param escrowId ID of the escrow to resolve
     * @param releaseToDriver Whether to release to driver (true) or refund to passenger (false)
     */
    function resolveDispute(uint256 escrowId, bool releaseToDriver) external onlyOwner {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.amount > 0, "Escrow does not exist");
        require(escrow.status == EscrowStatus.Disputed, "Escrow is not disputed");
        
        if (releaseToDriver) {
            escrow.status = EscrowStatus.Released;
            
            uint256 platformFee = (escrow.amount * platformFeePercent) / 10000;
            uint256 driverAmount = escrow.amount - platformFee;
            
            if (platformFee > 0) {
                (bool feeSuccess, ) = feeRecipient.call{value: platformFee}("");
                require(feeSuccess, "Platform fee transfer failed");
            }
            
            (bool driverSuccess, ) = escrow.driver.call{value: driverAmount}("");
            require(driverSuccess, "Driver payment failed");
            
            emit EscrowReleased(escrowId, escrow.driver, driverAmount, platformFee);
        } else {
            escrow.status = EscrowStatus.Refunded;
            
            (bool success, ) = escrow.passenger.call{value: escrow.amount}("");
            require(success, "Refund failed");
            
            emit EscrowRefunded(escrowId, escrow.passenger, escrow.amount);
        }
        
        escrow.updatedAt = block.timestamp;
    }
    
    /**
     * @dev Get escrow details
     * @param escrowId ID of the escrow
     */
    function getEscrowDetails(uint256 escrowId) external view returns (
        string memory rideId,
        address driver,
        address passenger,
        uint256 amount,
        EscrowStatus status
    ) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.amount > 0, "Escrow does not exist");
        
        return (
            escrow.rideId,
            escrow.driver,
            escrow.passenger,
            escrow.amount,
            escrow.status
        );
    }
    
    /**
     * @dev Update platform fee (owner only)
     * @param newFeePercent New fee percentage in basis points (e.g., 250 = 2.5%)
     */
    function updatePlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 1000, "Fee cannot exceed 10%");
        
        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFeePercent;
        
        emit PlatformFeeUpdated(oldFee, newFeePercent);
    }
    
    /**
     * @dev Update fee recipient (owner only)
     * @param newFeeRecipient New fee recipient address
     */
    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid fee recipient");
        
        address oldRecipient = feeRecipient;
        feeRecipient = newFeeRecipient;
        
        emit FeeRecipientUpdated(oldRecipient, newFeeRecipient);
    }
    
    /**
     * @dev Pause contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdrawal (owner only, when paused)
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }
    
    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}