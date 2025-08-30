// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title DriverVerificationContract
 * @dev Smart contract for managing driver verification on BlockDAG network
 */
contract DriverVerificationContract is Ownable, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    enum VerificationStatus {
        Pending,
        Verified,
        Rejected,
        Suspended
    }
    
    struct DriverVerification {
        string driverId;
        bytes32 documentHash;
        VerificationStatus status;
        uint256 verifiedAt;
        uint256 expiresAt;
        address verifier;
        string ipfsHash; // IPFS hash for encrypted documents
        uint256 reputationScore;
    }
    
    struct VerifierInfo {
        bool isAuthorized;
        string name;
        uint256 addedAt;
    }
    
    mapping(address => DriverVerification) public driverVerifications;
    mapping(string => address) public driverIdToAddress;
    mapping(address => VerifierInfo) public authorizedVerifiers;
    mapping(address => uint256) public driverReputationScores;
    
    address[] public verifiedDrivers;
    address[] public verifierList;
    
    // Verification validity period (1 year)
    uint256 public constant VERIFICATION_VALIDITY_PERIOD = 365 days;
    
    // Events
    event DriverVerified(
        address indexed driverAddress,
        string indexed driverId,
        bytes32 documentHash,
        address indexed verifier
    );
    
    event DriverRejected(
        address indexed driverAddress,
        string indexed driverId,
        address indexed verifier,
        string reason
    );
    
    event DriverSuspended(
        address indexed driverAddress,
        string indexed driverId,
        address indexed verifier,
        string reason
    );
    
    event VerifierAdded(
        address indexed verifier,
        string name
    );
    
    event VerifierRemoved(
        address indexed verifier
    );
    
    event ReputationUpdated(
        address indexed driverAddress,
        uint256 oldScore,
        uint256 newScore
    );
    
    event VerificationRenewed(
        address indexed driverAddress,
        uint256 newExpiryDate
    );
    
    modifier onlyAuthorizedVerifier() {
        require(authorizedVerifiers[msg.sender].isAuthorized, "Not an authorized verifier");
        _;
    }
    
    modifier onlyVerifiedDriver() {
        require(isDriverVerified(msg.sender), "Driver not verified");
        _;
    }
    
    /**
     * @dev Add an authorized verifier
     * @param verifier Address of the verifier
     * @param name Name of the verifier
     */
    function addVerifier(address verifier, string memory name) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        require(!authorizedVerifiers[verifier].isAuthorized, "Verifier already authorized");
        require(bytes(name).length > 0, "Verifier name cannot be empty");
        
        authorizedVerifiers[verifier] = VerifierInfo({
            isAuthorized: true,
            name: name,
            addedAt: block.timestamp
        });
        
        verifierList.push(verifier);
        
        emit VerifierAdded(verifier, name);
    }
    
    /**
     * @dev Remove an authorized verifier
     * @param verifier Address of the verifier to remove
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(authorizedVerifiers[verifier].isAuthorized, "Verifier not authorized");
        
        authorizedVerifiers[verifier].isAuthorized = false;
        
        // Remove from verifier list
        for (uint256 i = 0; i < verifierList.length; i++) {
            if (verifierList[i] == verifier) {
                verifierList[i] = verifierList[verifierList.length - 1];
                verifierList.pop();
                break;
            }
        }
        
        emit VerifierRemoved(verifier);
    }
    
    /**
     * @dev Verify a driver
     * @param driverAddress Address of the driver
     * @param driverId Unique driver ID
     * @param documentHash Hash of verification documents
     * @param ipfsHash IPFS hash for encrypted documents
     */
    function verifyDriver(
        address driverAddress,
        string memory driverId,
        bytes32 documentHash,
        string memory ipfsHash
    ) external onlyAuthorizedVerifier whenNotPaused {
        require(driverAddress != address(0), "Invalid driver address");
        require(bytes(driverId).length > 0, "Invalid driver ID");
        require(documentHash != bytes32(0), "Invalid document hash");
        require(bytes(ipfsHash).length > 0, "Invalid IPFS hash");
        
        // Check if driver ID is already taken by another address
        if (driverIdToAddress[driverId] != address(0)) {
            require(driverIdToAddress[driverId] == driverAddress, "Driver ID already taken");
        }
        
        DriverVerification storage verification = driverVerifications[driverAddress];
        
        // If this is a new verification or renewal
        if (verification.status != VerificationStatus.Verified) {
            verifiedDrivers.push(driverAddress);
        }
        
        verification.driverId = driverId;
        verification.documentHash = documentHash;
        verification.status = VerificationStatus.Verified;
        verification.verifiedAt = block.timestamp;
        verification.expiresAt = block.timestamp + VERIFICATION_VALIDITY_PERIOD;
        verification.verifier = msg.sender;
        verification.ipfsHash = ipfsHash;
        verification.reputationScore = 100; // Initial reputation score
        
        driverIdToAddress[driverId] = driverAddress;
        driverReputationScores[driverAddress] = 100;
        
        emit DriverVerified(driverAddress, driverId, documentHash, msg.sender);
    }
    
    /**
     * @dev Reject a driver verification
     * @param driverAddress Address of the driver
     * @param driverId Driver ID
     * @param reason Reason for rejection
     */
    function rejectDriver(
        address driverAddress,
        string memory driverId,
        string memory reason
    ) external onlyAuthorizedVerifier whenNotPaused {
        require(driverAddress != address(0), "Invalid driver address");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        
        DriverVerification storage verification = driverVerifications[driverAddress];
        verification.status = VerificationStatus.Rejected;
        
        emit DriverRejected(driverAddress, driverId, msg.sender, reason);
    }
    
    /**
     * @dev Suspend a driver
     * @param driverAddress Address of the driver
     * @param reason Reason for suspension
     */
    function suspendDriver(
        address driverAddress,
        string memory reason
    ) external onlyAuthorizedVerifier whenNotPaused {
        require(driverAddress != address(0), "Invalid driver address");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(isDriverVerified(driverAddress), "Driver not verified");
        
        DriverVerification storage verification = driverVerifications[driverAddress];
        verification.status = VerificationStatus.Suspended;
        
        emit DriverSuspended(driverAddress, verification.driverId, msg.sender, reason);
    }
    
    /**
     * @dev Update driver reputation score
     * @param driverAddress Address of the driver
     * @param newScore New reputation score (0-1000)
     */
    function updateReputationScore(
        address driverAddress,
        uint256 newScore
    ) external onlyAuthorizedVerifier {
        require(driverAddress != address(0), "Invalid driver address");
        require(newScore <= 1000, "Score cannot exceed 1000");
        require(isDriverVerified(driverAddress), "Driver not verified");
        
        uint256 oldScore = driverReputationScores[driverAddress];
        driverReputationScores[driverAddress] = newScore;
        driverVerifications[driverAddress].reputationScore = newScore;
        
        emit ReputationUpdated(driverAddress, oldScore, newScore);
    }
    
    /**
     * @dev Renew driver verification
     * @param driverAddress Address of the driver
     */
    function renewVerification(address driverAddress) external onlyAuthorizedVerifier {
        require(driverAddress != address(0), "Invalid driver address");
        
        DriverVerification storage verification = driverVerifications[driverAddress];
        require(verification.status == VerificationStatus.Verified, "Driver not verified");
        
        verification.expiresAt = block.timestamp + VERIFICATION_VALIDITY_PERIOD;
        verification.verifier = msg.sender;
        
        emit VerificationRenewed(driverAddress, verification.expiresAt);
    }
    
    /**
     * @dev Check if a driver is verified and not expired
     * @param driverAddress Address of the driver
     */
    function isDriverVerified(address driverAddress) public view returns (bool) {
        DriverVerification storage verification = driverVerifications[driverAddress];
        return verification.status == VerificationStatus.Verified && 
               block.timestamp < verification.expiresAt;
    }
    
    /**
     * @dev Get driver verification details
     * @param driverAddress Address of the driver
     */
    function getDriverVerification(address driverAddress) external view returns (
        string memory driverId,
        bytes32 documentHash,
        VerificationStatus status,
        uint256 verifiedAt,
        uint256 expiresAt,
        address verifier,
        string memory ipfsHash,
        uint256 reputationScore
    ) {
        DriverVerification storage verification = driverVerifications[driverAddress];
        return (
            verification.driverId,
            verification.documentHash,
            verification.status,
            verification.verifiedAt,
            verification.expiresAt,
            verification.verifier,
            verification.ipfsHash,
            verification.reputationScore
        );
    }
    
    /**
     * @dev Get driver address by driver ID
     * @param driverId Driver ID
     */
    function getDriverAddressById(string memory driverId) external view returns (address) {
        return driverIdToAddress[driverId];
    }
    
    /**
     * @dev Get all verified drivers
     */
    function getVerifiedDrivers() external view returns (address[] memory) {
        return verifiedDrivers;
    }
    
    /**
     * @dev Get all authorized verifiers
     */
    function getAuthorizedVerifiers() external view returns (address[] memory) {
        return verifierList;
    }
    
    /**
     * @dev Get driver reputation score
     * @param driverAddress Address of the driver
     */
    function getDriverReputationScore(address driverAddress) external view returns (uint256) {
        return driverReputationScores[driverAddress];
    }
    
    /**
     * @dev Check if verification is expired
     * @param driverAddress Address of the driver
     */
    function isVerificationExpired(address driverAddress) external view returns (bool) {
        DriverVerification storage verification = driverVerifications[driverAddress];
        return block.timestamp >= verification.expiresAt;
    }
    
    /**
     * @dev Get verification expiry date
     * @param driverAddress Address of the driver
     */
    function getVerificationExpiry(address driverAddress) external view returns (uint256) {
        return driverVerifications[driverAddress].expiresAt;
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
     * @dev Get total number of verified drivers
     */
    function getTotalVerifiedDrivers() external view returns (uint256) {
        return verifiedDrivers.length;
    }
    
    /**
     * @dev Get total number of authorized verifiers
     */
    function getTotalAuthorizedVerifiers() external view returns (uint256) {
        return verifierList.length;
    }
}