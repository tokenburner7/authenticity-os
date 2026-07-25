#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("auth")
  .description("Authenticity protocol CLI")
  .version("0.0.1");

program.parse();