// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

interface IX402SubnameRegistrar {
    function register(bytes32 parentNode, string calldata label) external payable;
    function mintFee() external view returns (uint256);
}

/**
 * @title X402RegistrarForwarder
 * @notice Lets platforms charge their own fee on top of the protocol mintFee
 *         and receive it atomically in the same tx as the registration.
 *         The subname is minted to the forwarder then transferred to the user.
 */
contract X402RegistrarForwarder is Ownable, ReentrancyGuard, ERC1155Holder {
    IX402SubnameRegistrar public immutable registrar;
    IERC1155             public immutable nameWrapper;

    /// @notice Absolute cap on platform fee (wei). Owner-tunable.
    uint256 public maxPlatformFee = 0.05 ether;

    event RegisteredVia(
        address indexed platformTreasury,
        address indexed user,
        bytes32 indexed parentNode,
        string  label,
        uint256 protocolFee,
        uint256 platformFee
    );
    event MaxPlatformFeeUpdated(uint256 oldCap, uint256 newCap);
    event StrayEthSwept(address indexed to, uint256 amount);

    constructor(address _registrar, address _nameWrapper) Ownable(msg.sender) {
        registrar   = IX402SubnameRegistrar(_registrar);
        nameWrapper = IERC1155(_nameWrapper);
    }

    function setMaxPlatformFee(uint256 newCap) external onlyOwner {
        emit MaxPlatformFeeUpdated(maxPlatformFee, newCap);
        maxPlatformFee = newCap;
    }

    /**
     * @notice Register a subname and pay the platform fee in one tx.
     * @param parentNode       ENS namehash of supported parent (e.g. 402bot.eth)
     * @param label            subdomain label
     * @param platformTreasury address that receives the platform fee
     * @param platformFee      amount paid to the platform (wei)
     */
    function registerVia(
        bytes32 parentNode,
        string  calldata label,
        address platformTreasury,
        uint256 platformFee
    ) external payable nonReentrant {
        require(platformTreasury != address(0), "treasury=0");
        require(platformFee <= maxPlatformFee, "platformFee > cap");

        uint256 protocolFee = registrar.mintFee();
        uint256 required    = protocolFee + platformFee;
        require(msg.value >= required, "insufficient value");

        // Register — subname mints to this contract, ERC1155Holder accepts it.
        registrar.register{value: protocolFee}(parentNode, label);

        // Hand the subname to the user.
        bytes32 subnameNode = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        uint256 tokenId     = uint256(subnameNode);
        nameWrapper.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        // Pay the platform.
        if (platformFee > 0) {
            (bool paid, ) = platformTreasury.call{value: platformFee}("");
            require(paid, "platform pay failed");
        }

        // Refund overpayment from this tx only. We send exactly protocolFee to
        // the registrar so there is no registrar refund to forward. Reading
        // address(this).balance here would also sweep any stray ETH others
        // may have deposited via receive(), which we don't want.
        uint256 overpaid = msg.value - protocolFee - platformFee;
        if (overpaid > 0) {
            (bool refunded, ) = msg.sender.call{value: overpaid}("");
            require(refunded, "refund failed");
        }

        emit RegisteredVia(platformTreasury, msg.sender, parentNode, label, protocolFee, platformFee);
    }

    /// @notice Recover stray ETH (e.g. accidental sends). Does not affect
    ///         in-flight registrations because `registerVia` only refunds the
    ///         caller's own overpayment, not the contract balance.
    function sweepStrayEth(address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        uint256 bal = address(this).balance;
        require(bal > 0, "nothing to sweep");
        (bool ok, ) = to.call{value: bal}("");
        require(ok, "sweep failed");
        emit StrayEthSwept(to, bal);
    }

    /// @notice Accept ETH refunds from the registrar.
    receive() external payable {}
}
