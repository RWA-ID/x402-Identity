import { z } from "zod";
import { encodeFunctionData, formatEther } from "viem";
import { getMintFee, isAvailable, validateLabel, buildRegisterViaCalldata, } from "@x402identity/widget-core";
import { PARENTS, REGISTRAR, FORWARDER, MAX_BATCH, parentNodeOf, registerAbi, } from "../chain.js";
import { jsonResult, errorResult } from "../result.js";
function widgetCfg(ctx) {
    return { registrar: REGISTRAR, forwarder: FORWARDER, publicClient: ctx.publicClient };
}
/** Encode a single-name mint — via the forwarder when a platform fee is configured. */
function buildSingleTx(ctx, parent, label, mintFee) {
    if (ctx.platform) {
        return {
            to: FORWARDER,
            data: buildRegisterViaCalldata({
                parentNode: parentNodeOf(parent),
                label,
                platformTreasury: ctx.platform.treasury,
                platformFee: ctx.platform.feeWei,
            }),
            value: mintFee + ctx.platform.feeWei,
        };
    }
    return {
        to: REGISTRAR,
        data: encodeFunctionData({
            abi: registerAbi,
            functionName: "register",
            args: [parentNodeOf(parent), label],
        }),
        value: mintFee,
    };
}
async function execute(ctx, tx, summary) {
    if (!ctx.wallet) {
        return jsonResult({
            mode: "prepare-only",
            ...summary,
            transaction: tx,
            instructions: "No signing key is configured. Sign and broadcast this transaction with your own " +
                "wallet (to/data/value are complete). Set X402_PRIVATE_KEY to let this server sign.",
        });
    }
    if (tx.value > ctx.maxSpendWei) {
        return errorResult(`Refusing to send: value ${formatEther(tx.value)} ETH exceeds the spend cap of ` +
            `${formatEther(ctx.maxSpendWei)} ETH (raise X402_MAX_SPEND_WEI to override).`);
    }
    const hash = await ctx.wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        account: ctx.wallet.account,
        chain: ctx.wallet.chain,
    });
    const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
    return jsonResult({
        mode: "wallet",
        ...summary,
        transactionHash: hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
    });
}
export function registerRegisterTools(server, ctx) {
    server.registerTool("register_subname", {
        description: "Mint a permanent ENS subname under 402bot.eth, 402api.eth, or 402mcp.eth. " +
            "If a signing key is configured the transaction is sent on-chain and the tool " +
            "returns the receipt; otherwise it returns a fully-encoded transaction " +
            "(to, data, value) for the caller to sign. Names never expire.",
        inputSchema: {
            label: z.string().describe("Subname label, e.g. 'myagent'"),
            parent: z.enum(PARENTS).describe("Parent name to mint under"),
        },
    }, async ({ label, parent }) => {
        try {
            const normalized = label.toLowerCase().trim();
            const invalid = validateLabel(normalized);
            if (invalid)
                return errorResult(`Invalid label: ${invalid}`);
            const available = await isAvailable(widgetCfg(ctx), parentNodeOf(parent), normalized);
            if (!available)
                return errorResult(`${normalized}.${parent} is already registered.`);
            const mintFee = await getMintFee(widgetCfg(ctx));
            const tx = buildSingleTx(ctx, parent, normalized, mintFee);
            return await execute(ctx, tx, {
                name: `${normalized}.${parent}`,
                totalCostEth: formatEther(tx.value),
            });
        }
        catch (err) {
            return errorResult(`Registration failed: ${err.message}`);
        }
    });
    server.registerTool("batch_register", {
        description: `Mint up to ${MAX_BATCH} ENS subnames in a single transaction via the registrar's ` +
            "batchRegister. Same prepare-or-sign behavior as register_subname. " +
            "Note: batch minting always pays the protocol fee only (no platform fee routing).",
        inputSchema: {
            registrations: z
                .array(z.object({
                label: z.string(),
                parent: z.enum(PARENTS),
            }))
                .min(1)
                .max(MAX_BATCH)
                .describe("Names to mint"),
        },
    }, async ({ registrations }) => {
        try {
            const items = registrations.map((r) => ({
                label: r.label.toLowerCase().trim(),
                parent: r.parent,
            }));
            for (const { label, parent } of items) {
                const invalid = validateLabel(label);
                if (invalid)
                    return errorResult(`Invalid label '${label}': ${invalid}`);
                const available = await isAvailable(widgetCfg(ctx), parentNodeOf(parent), label);
                if (!available)
                    return errorResult(`${label}.${parent} is already registered.`);
            }
            const mintFee = await getMintFee(widgetCfg(ctx));
            const value = mintFee * BigInt(items.length);
            const tx = {
                to: REGISTRAR,
                data: encodeFunctionData({
                    abi: registerAbi,
                    functionName: "batchRegister",
                    args: [items.map((i) => parentNodeOf(i.parent)), items.map((i) => i.label)],
                }),
                value,
            };
            return await execute(ctx, tx, {
                names: items.map((i) => `${i.label}.${i.parent}`),
                totalCostEth: formatEther(value),
            });
        }
        catch (err) {
            return errorResult(`Batch registration failed: ${err.message}`);
        }
    });
}
//# sourceMappingURL=register.js.map