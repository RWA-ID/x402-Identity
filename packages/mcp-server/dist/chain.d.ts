import { type Address, type Hex, type PublicClient, type WalletClient, type Account, type Chain } from "viem";
export declare const REGISTRAR: `0x${string}`;
export declare const FORWARDER: `0x${string}`;
export declare const NAME_WRAPPER: `0x${string}`;
export declare const REGISTRAR_FLOOR_BLOCK = 24500000n;
export declare const MAX_BATCH = 10;
export declare const PARENTS: readonly ["402bot.eth", "402api.eth", "402mcp.eth"];
export type ParentName = (typeof PARENTS)[number];
export declare function parentNodeOf(parent: ParentName): Hex;
export declare const NODE_TO_PARENT: ReadonlyMap<Hex, ParentName>;
export declare const registerAbi: readonly [{
    readonly name: "register";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "parentNode";
        readonly type: "bytes32";
    }, {
        readonly name: "label";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "batchRegister";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "parentNodes";
        readonly type: "bytes32[]";
    }, {
        readonly name: "labels";
        readonly type: "string[]";
    }];
    readonly outputs: readonly [];
}];
export declare const subnameMintedEvent: {
    readonly name: "SubnameMinted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "parentNode";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "label";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "subnameNode";
        readonly type: "bytes32";
        readonly indexed: false;
    }, {
        readonly name: "minter";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "fee";
        readonly type: "uint256";
        readonly indexed: false;
    }];
};
/** Forwarder event — carries the real user for mints routed via registerVia. */
export declare const registeredViaEvent: {
    readonly name: "RegisteredVia";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "platformTreasury";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "user";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "parentNode";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "label";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "protocolFee";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "platformFee";
        readonly type: "uint256";
        readonly indexed: false;
    }];
};
export declare const nameWrapperAbi: readonly [{
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "id";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}];
export interface Ctx {
    publicClient: PublicClient;
    /** Present only in wallet mode (X402_PRIVATE_KEY set). */
    wallet: (WalletClient & {
        account: Account;
        chain: Chain;
    }) | null;
    /** Hard cap on ETH a single wallet-mode call may spend. */
    maxSpendWei: bigint;
    /** Optional platform-fee config — routes mints through the forwarder. */
    platform: {
        treasury: Address;
        feeWei: bigint;
    } | null;
}
export declare function buildContext(env?: NodeJS.ProcessEnv): Ctx;
