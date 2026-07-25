#!/usr/bin/env node
import { Command } from "commander";
import { identityCommand } from "./commands/identity.js";
import { attestCommand } from "./commands/attest.js";
import { vouchCommand } from "./commands/vouch.js";
import { verifyCommand } from "./commands/verify.js";
import { reputationCommand } from "./commands/reputation.js";
import { exportCommand } from "./commands/export.js";
import { importCommand } from "./commands/import.js";
import { agentCommand } from "./commands/agent.js";

const program = new Command();

program
  .name("auth")
  .description("Authenticity protocol CLI")
  .version("0.0.1");

program.addCommand(identityCommand);
program.addCommand(attestCommand);
program.addCommand(vouchCommand);
program.addCommand(verifyCommand);
program.addCommand(reputationCommand);
program.addCommand(exportCommand);
program.addCommand(importCommand);
program.addCommand(agentCommand);

program.parse();