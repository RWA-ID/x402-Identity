// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockENSRegistry {
    mapping(bytes32 => address) public owner;
    function setOwner(bytes32 node, address o) external { owner[node] = o; }
}
