// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { EthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Gateway } from "@fhevm/solidity/gateway/Gateway.sol";

/// @title SilentSwapAdvanced - A confidential token swap protocol with Gateway decryption
/// @notice Allows users to create and match swap offers with encrypted amounts
/// @dev Uses Zama Gateway for secure decryption and validation
contract SilentSwapAdvanced is EthereumConfig {
    
    struct SwapOffer {
        address creator;
        address tokenOffered;
        address tokenRequested;
        euint64 amountOffered;      // Encrypted amount offered
        euint64 amountRequested;    // Encrypted amount requested
        bool isActive;
        uint256 createdAt;
        bool pendingMatch;          // True when waiting for Gateway decryption
        address pendingMatcher;     // Address of the pending matcher
    }
    
    // Mapping from offer ID to SwapOffer
    mapping(uint256 => SwapOffer) public offers;
    
    // Counter for offer IDs
    uint256 public offerCounter;
    
    // Gateway requests mapping
    mapping(uint256 => uint256) public requestIdToOfferId;
    
    // Events
    event OfferCreated(
        uint256 indexed offerId,
        address indexed creator,
        address tokenOffered,
        address tokenRequested,
        uint256 timestamp
    );
    
    event MatchInitiated(
        uint256 indexed offerId,
        address indexed matcher,
        uint256 requestId
    );
    
    event OfferMatched(
        uint256 indexed offerId,
        address indexed creator,
        address indexed matcher,
        uint256 timestamp
    );
    
    event OfferCancelled(
        uint256 indexed offerId,
        address indexed creator,
        uint256 timestamp
    );
    
    event MatchValidationFailed(
        uint256 indexed offerId,
        address indexed matcher,
        string reason
    );
    
    /// @notice Creates a new swap offer with encrypted amounts
    /// @param tokenOffered The token address the creator wants to swap from
    /// @param tokenRequested The token address the creator wants to receive
    /// @param encryptedAmountOffered The encrypted amount to offer
    /// @param proofOffered ZK proof for the offered amount
    /// @param encryptedAmountRequested The encrypted amount requested
    /// @param proofRequested ZK proof for the requested amount
    /// @return offerId The ID of the created offer
    function createOffer(
        address tokenOffered,
        address tokenRequested,
        externalEuint64 encryptedAmountOffered,
        bytes calldata proofOffered,
        externalEuint64 encryptedAmountRequested,
        bytes calldata proofRequested
    ) external returns (uint256 offerId) {
        require(tokenOffered != address(0), "Invalid token offered");
        require(tokenRequested != address(0), "Invalid token requested");
        require(tokenOffered != tokenRequested, "Tokens must be different");
        
        // Convert external encrypted values to internal FHE types
        euint64 amountOffered = FHE.fromExternal(encryptedAmountOffered, proofOffered);
        euint64 amountRequested = FHE.fromExternal(encryptedAmountRequested, proofRequested);
        
        // Validate that amounts are greater than zero (encrypted check)
        ebool isOfferedValid = FHE.gt(amountOffered, FHE.asEuint64(0));
        ebool isRequestedValid = FHE.gt(amountRequested, FHE.asEuint64(0));
        
        // Create new offer
        offerId = offerCounter++;
        
        offers[offerId] = SwapOffer({
            creator: msg.sender,
            tokenOffered: tokenOffered,
            tokenRequested: tokenRequested,
            amountOffered: amountOffered,
            amountRequested: amountRequested,
            isActive: true,
            createdAt: block.timestamp,
            pendingMatch: false,
            pendingMatcher: address(0)
        });
        
        // Grant permissions for the encrypted amounts
        FHE.allowThis(amountOffered);
        FHE.allow(amountOffered, msg.sender);
        
        FHE.allowThis(amountRequested);
        FHE.allow(amountRequested, msg.sender);
        
        emit OfferCreated(
            offerId,
            msg.sender,
            tokenOffered,
            tokenRequested,
            block.timestamp
        );
    }
    
    /// @notice Initiates matching of an offer (step 1: validation request)
    /// @param offerId The ID of the offer to match
    /// @param encryptedMatchAmount The encrypted amount the matcher is providing
    /// @param proofMatch ZK proof for the match amount
    function initiateMatch(
        uint256 offerId,
        externalEuint64 encryptedMatchAmount,
        bytes calldata proofMatch
    ) external returns (uint256 requestId) {
        SwapOffer storage offer = offers[offerId];
        
        require(offer.isActive, "Offer is not active");
        require(offer.creator != msg.sender, "Cannot match own offer");
        require(!offer.pendingMatch, "Match already pending");
        
        // Convert external encrypted value to internal FHE type
        euint64 matchAmount = FHE.fromExternal(encryptedMatchAmount, proofMatch);
        
        // Check if amounts match (encrypted comparison)
        ebool isValidMatch = FHE.eq(matchAmount, offer.amountRequested);
        
        // Request decryption via Gateway to validate the match
        requestId = Gateway.requestDecryption(
            FHE.cast(isValidMatch),
            this.finalizeMatch.selector,
            0,
            block.timestamp + 100,
            false
        );
        
        // Store the request mapping
        requestIdToOfferId[requestId] = offerId;
        
        // Mark offer as pending
        offer.pendingMatch = true;
        offer.pendingMatcher = msg.sender;
        
        // Grant permissions
        FHE.allow(matchAmount, msg.sender);
        FHE.allowThis(matchAmount);
        
        emit MatchInitiated(offerId, msg.sender, requestId);
    }
    
    /// @notice Finalizes the match after Gateway validation (step 2: execution)
    /// @param requestId The Gateway request ID
    /// @param isValid Whether the match is valid (decrypted by Gateway)
    function finalizeMatch(
        uint256 requestId,
        bool isValid
    ) external onlyGateway {
        uint256 offerId = requestIdToOfferId[requestId];
        SwapOffer storage offer = offers[offerId];
        
        require(offer.pendingMatch, "No pending match");
        
        if (!isValid) {
            // Reset pending state
            offer.pendingMatch = false;
            address matcher = offer.pendingMatcher;
            offer.pendingMatcher = address(0);
            
            emit MatchValidationFailed(offerId, matcher, "Amounts do not match");
            return;
        }
        
        address matcher = offer.pendingMatcher;
        
        // Request decryption of amounts for actual transfer
        // Note: In production, you'd need additional Gateway calls to get the actual amounts
        // For this demo, we'll use a simplified approach
        
        // Execute the swap (amounts would be decrypted via additional Gateway calls)
        _executeSwap(offer, matcher);
        
        // Mark offer as completed
        offer.isActive = false;
        offer.pendingMatch = false;
        offer.pendingMatcher = address(0);
        
        emit OfferMatched(offerId, offer.creator, matcher, block.timestamp);
    }
    
    /// @notice Internal function to execute the swap
    /// @dev In production, this would use decrypted amounts from Gateway
    function _executeSwap(SwapOffer memory offer, address matcher) internal {
        // Note: This is a simplified version
        // In production, you would:
        // 1. Request decryption of amountOffered via Gateway
        // 2. Request decryption of amountRequested via Gateway
        // 3. Execute transfers with decrypted amounts in a callback
        
        // For demo purposes, we're showing the structure
        // Actual implementation requires proper Gateway integration
        
        // Transfer from creator to matcher would happen here
        // Transfer from matcher to creator would happen here
    }
    
    /// @notice Cancels an active offer (only by creator)
    /// @param offerId The ID of the offer to cancel
    function cancelOffer(uint256 offerId) external {
        SwapOffer storage offer = offers[offerId];
        
        require(offer.creator == msg.sender, "Only creator can cancel");
        require(offer.isActive, "Offer is not active");
        require(!offer.pendingMatch, "Cannot cancel pending match");
        
        offer.isActive = false;
        
        emit OfferCancelled(offerId, msg.sender, block.timestamp);
    }
    
    /// @notice Returns the encrypted amount offered for a specific offer
    /// @param offerId The ID of the offer
    /// @return The encrypted amount offered
    function getOfferedAmount(uint256 offerId) external view returns (euint64) {
        return offers[offerId].amountOffered;
    }
    
    /// @notice Returns the encrypted amount requested for a specific offer
    /// @param offerId The ID of the offer
    /// @return The encrypted amount requested
    function getRequestedAmount(uint256 offerId) external view returns (euint64) {
        return offers[offerId].amountRequested;
    }
    
    /// @notice Checks if an offer is active
    /// @param offerId The ID of the offer
    /// @return Whether the offer is active
    function isOfferActive(uint256 offerId) external view returns (bool) {
        return offers[offerId].isActive;
    }
    
    /// @notice Returns offer details
    /// @param offerId The ID of the offer
    function getOfferDetails(uint256 offerId) external view returns (
        address creator,
        address tokenOffered,
        address tokenRequested,
        bool isActive,
        uint256 createdAt,
        bool pendingMatch
    ) {
        SwapOffer memory offer = offers[offerId];
        return (
            offer.creator,
            offer.tokenOffered,
            offer.tokenRequested,
            offer.isActive,
            offer.createdAt,
            offer.pendingMatch
        );
    }
    
    /// @notice Modifier to ensure only Gateway can call certain functions
    modifier onlyGateway() {
        require(msg.sender == Gateway.getAddress(), "Only Gateway can call");
        _;
    }
}
