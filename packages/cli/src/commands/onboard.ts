/**
 * @auth/cli — creator onboarding command
 *
 * Interactive wizard that guides a creator through:
 * 1. Creating an identity
 * 2. Getting vouched for by existing community members
 * 3. Attesting their first piece of content
 * 4. Exporting their credential for display on social platforms
 */

import { Command } from "commander";
import { createIdentity, attestCreation, contentHash, toW3CVC, type Identity } from "@auth/protocol";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadStore, saveStore } from "../store.js";

export const onboardCommand = new Command("onboard")
  .description("Interactive creator onboarding wizard")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .action(async (opts) => {
    const rl = createInterface({ input: stdin, output: stdout });

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║     Authenticity OS — Creator Onboarding         ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // Step 1: Create or load identity
    const store = loadStore(opts.store);

    if (store.identity) {
      console.log(`Welcome back, ${store.identity.handle}!`);
      console.log(`Your ID: ${store.identity.id.slice(0, 24)}...\n`);
    } else {
      console.log("Step 1: Create your identity\n");
      const handle = await rl.question("What's your creator handle? (e.g. @yourname): ");
      if (!handle.trim()) {
        console.log("Handle is required. Exiting.");
        rl.close();
        process.exit(1);
      }

      const identity = createIdentity(handle.trim(), "peer");
      store.identity = identity;
      saveStore(opts.store, store);

      console.log(`\n✓ Identity created!`);
      console.log(`  Handle: ${identity.handle}`);
      console.log(`  ID: ${identity.id}`);
      console.log(`  Assurance: peer (upgrade by getting vouched)\n`);
    }

    // Step 2: Reputation guidance
    console.log("Step 2: Build your reputation\n");
    console.log("Your reputation grows when other verified creators vouch for you.");
    console.log("Share your ID with trusted community members:");
    console.log(`  ${store.identity!.id}\n`);
    console.log("They can vouch for you with:");
    console.log(`  auth vouch --target ${store.identity!.id.slice(0, 24)}...\n`);

    const wantVouch = await rl.question("Has someone already vouched for you? (y/n): ");
    if (wantVouch.trim().toLowerCase() === "y") {
      console.log("\nGreat! Your reputation will reflect their vouches.");
    } else {
      console.log("\nNo problem. You can still attest content without reputation,");
      console.log("but platforms may require a minimum reputation score.");
    }

    // Step 3: First content attestation
    console.log("\nStep 3: Attest your first content\n");
    const content = await rl.question("Paste a short piece of content to attest (or press Enter to skip): ");

    if (content.trim()) {
      const aiLevel = await rl.question("AI assistance level (none/partial/ai-assisted/fully-ai) [none]: ");
      const level = (aiLevel.trim() || "none") as "none" | "partial" | "ai-assisted" | "fully-ai";

      const identity = store.identity as Identity;
      const hash = contentHash(content.trim());
      const credential = attestCreation(identity, hash, level);

      store.credentials = store.credentials ?? [];
      store.credentials.push(credential);
      saveStore(opts.store, store);

      console.log(`\n✓ Content attested!`);
      console.log(`  Content hash: ${hash.slice(0, 24)}...`);
      console.log(`  AI assistance: ${level}`);

      // Step 4: Export for display
      console.log("\nStep 4: Export your credential\n");
      const w3c = toW3CVC(credential);
      console.log("Your W3C Verifiable Credential (share this on your platform):");
      console.log(JSON.stringify(w3c, null, 2));
      console.log("\n✓ Onboarding complete! You're now a verified creator.");
    } else {
      console.log("\nSkipped content attestation. You can do this later with:");
      console.log("  auth attest --content \"your content\" --ai-assistance none");
      console.log("\n✓ Onboarding complete!");
    }

    console.log("\nNext steps:");
    console.log("  • Get vouched by trusted creators to build reputation");
    console.log("  • Attest your content with `auth attest`");
    console.log("  • Export credentials with `auth export`");
    console.log("  • Start a networked agent with `auth agent start`\n");

    rl.close();
  });