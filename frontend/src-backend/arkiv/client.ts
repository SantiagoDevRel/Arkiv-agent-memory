// src/arkiv/client.ts
// Initializes and exports the Arkiv SDK clients connected to the Kaolin testnet.
// All agents import these client instances — no agent creates its own.
// Kaolin testnet config:
//   Chain ID: 60138453025
//   RPC: https://kaolin.hoodi.arkiv.network/rpc
//   Explorer: https://explorer.kaolin.hoodi.arkiv.network

import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk";
import { kaolin } from "@arkiv-network/sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const privateKey = process.env.ARKIV_PRIVATE_KEY as Hex | undefined;
if (!privateKey) {
  throw new Error("[arkiv] ARKIV_PRIVATE_KEY is not set in environment variables");
}

const account = privateKeyToAccount(privateKey);

export const publicClient = createPublicClient({
  chain: kaolin,
  transport: http(),
});

export const walletClient = createWalletClient({
  chain: kaolin,
  transport: http(),
  account,
});

console.log(`[arkiv] clients initialized for Kaolin (chain ${kaolin.id}), account: ${account.address}`);
