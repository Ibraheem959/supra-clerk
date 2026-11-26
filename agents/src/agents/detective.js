import { investigate } from "../supra/investigate.js";

export async function investigateWallet(chain, input) {
  return investigate(chain, input);
}
