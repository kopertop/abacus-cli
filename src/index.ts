#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { registerCodeCommands } from './commands/code';

config();

async function initializeCliEnvironment() {
	const abacusDir = join(process.cwd(), '.abacus');
	try {
		await mkdir(abacusDir, { recursive: true });
	} catch (error) {
		console.error('Error creating .abacus directory:', error);
	}
}

async function main() {
	await initializeCliEnvironment();

	const program = new Command();

	program
		.name('abacus-cli')
		.description('Code-focused CLI tool for Abacus.ai API')
		.version('0.0.1');

	registerCodeCommands(program);

	// Add global options
	program
		.option('-d, --debug', 'Enable debug mode')
		.option('-v, --verbose', 'Enable verbose output');

	program.parse();
}

main().catch(console.error);
