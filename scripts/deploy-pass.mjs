// Deploys contracts/AestrodomPass.sol (compiled artifact: contracts/AestrodomPass.json) to Robinhood Chain.
//
//   node scripts/deploy-pass.mjs            # dry run: prints what would be deployed and the cost
//   node scripts/deploy-pass.mjs --send     # deploys and prints the contract address
//   --open-in-hours=10                      # minting opens by itself 10 hours after deploy (default: right away)
//
// Signs with DEPLOYER_PRIVATE_KEY, or SPONSOR_PRIVATE_KEY when that is unset. The key is never printed.
// The contract owner (can pause minting / change metadata) is PASS_OWNER, default the treasury wallet.
// Afterwards set PASS_CONTRACT_ADDRESS to the printed address.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, encodeDeployData, formatEther, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const send = process.argv.includes("--send");
const rpc = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const chain = defineChain({ id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const owner = getAddress(process.env.PASS_OWNER || process.env.CREDITS_TREASURY_ADDRESS || "0x13d471c30f28081fac917a2112478548978eff86");
const metadataURI = process.env.PASS_METADATA_URI || "ipfs://bafkreie3ha23gue4yq6wev476ydioxequ3ex2t3uvbjjdi5aas64gsdkge";

const raw = (process.env.DEPLOYER_PRIVATE_KEY || process.env.SPONSOR_PRIVATE_KEY || "").trim();
if (!raw) {
  console.error("Set DEPLOYER_PRIVATE_KEY or SPONSOR_PRIVATE_KEY.");
  process.exit(1);
}
const account = privateKeyToAccount(raw.startsWith("0x") ? raw : `0x${raw}`);
const artifact = JSON.parse(readFileSync(new URL("../contracts/AestrodomPass.json", import.meta.url), "utf8"));
const hoursArg = process.argv.find((a) => a.startsWith("--open-in-hours="));
const openInHours = hoursArg ? Number(hoursArg.split("=")[1]) : 0;
if (!Number.isFinite(openInHours) || openInHours < 0) {
  console.error("--open-in-hours must be a number of hours.");
  process.exit(1);
}
const mintStart = BigInt(Math.floor(Date.now() / 1000 + openInHours * 3600));
const args = [metadataURI, owner, mintStart];

const pub = createPublicClient({ chain, transport: http(rpc) });
const [gas, gasPrice, balance] = await Promise.all([
  // An empty wallet cannot be estimated; ~1.5M gas is what the deployment measured on Robinhood Chain.
  pub.estimateGas({ account, data: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args }) }).catch(() => 1_600_000n),
  pub.getGasPrice(),
  pub.getBalance({ address: account.address }),
]);
console.log(`Deployer:   ${account.address} (${formatEther(balance)} ETH)`);
console.log(`Owner:      ${owner}`);
console.log(`Metadata:   ${metadataURI}`);
console.log(`Mint opens: ${new Date(Number(mintStart) * 1000).toISOString()}`);
console.log(`Est. cost:  ${formatEther(gas * gasPrice)} ETH`);
if (balance < (gas * gasPrice * 3n) / 2n) {
  console.error("The deployer wallet needs a little ETH on Robinhood Chain first.");
  process.exit(1);
}
if (!send) {
  console.log("Dry run. Re-run with --send to deploy.");
  process.exit(0);
}
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args });
console.log(`Tx:         ${hash}`);
const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error("Deployment failed.");
  process.exit(1);
}
console.log(`PASS_CONTRACT_ADDRESS=${receipt.contractAddress}`);
