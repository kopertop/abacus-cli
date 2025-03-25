import { Command } from 'commander';
import { FileManager } from '../utils/fileManager';
import { MemoryManager } from '../utils/database';

export function registerCodeCommands(program: Command) {
	const fileManager = new FileManager();
	const memoryManager = new MemoryManager();

	program
		.command('analyze')
		.description('Analyze code structure in current directory')
		.option('-p, --pattern <pattern>', 'File pattern to analyze', '**/*.{ts,js,tsx,jsx}')
		.action(async (options) => {
			try {
				console.log('Analyzing code structure...');
				const stats = await fileManager.analyzeDirectory();
				console.log('\nProject Overview:');
				console.log('-----------------');
				console.log(`Total Files: ${stats.files}`);
				console.log(`Total Directories: ${stats.directories}`);
				console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

				console.log('\nFile Types:');
				console.log('-----------');
				Object.entries(stats.typeBreakdown)
					.sort(([, a], [, b]) => b - a)
					.forEach(([ext, count]) => {
						console.log(`${ext}: ${count} files`);
					});
			} catch (error) {
				console.error('Error analyzing directory:', error);
			}
		});

	program
		.command('explain')
		.description('Explain code in a file')
		.argument('<file>', 'File to explain')
		.option('-t, --tags <tags>', 'Tags to associate with the code', '')
		.action(async (file, options) => {
			try {
				console.log(`Reading file: ${file}`);
				const content = await fileManager.readFile(file);
				const analysis = await fileManager.analyzeFile(file);

				const tags = options.tags ? options.tags.split(',') : [];
				const contextId = await memoryManager.storeCodeContext(file, content, tags);

				console.log('\nFile Analysis:');
				console.log('--------------');
				console.log(`Size: ${(analysis.size / 1024).toFixed(2)} KB`);
				console.log(`Lines: ${analysis.lines}`);
				console.log(`Hash: ${analysis.hash}`);

				if (tags.length > 0) {
					console.log(`Tags: ${tags.join(', ')}`);
				}

				console.log(`\nStored in memory with context ID: ${contextId}`);
			} catch (error) {
				console.error('Error explaining code:', error);
			}
		});

	program
		.command('search')
		.description('Search through code memory')
		.argument('<query>', 'Search query')
		.action(async (query) => {
			try {
				console.log(`Searching for: ${query}`);
				const results = await memoryManager.searchMemory(query);

				if (results.length === 0) {
					console.log('No results found.');
					return;
				}

				console.log('\nSearch Results:');
				console.log('---------------');
				results.forEach((result, index) => {
					console.log(`\n[${index + 1}] ${result.file_path}`);
					if (result.tags && result.tags.length > 0) {
						console.log(`Tags: ${result.tags.join(', ')}`);
					}
					if (result.prompt) {
						console.log(`Prompt: ${result.prompt}`);
						console.log(`Response: ${result.response}`);
					}
				});
			} catch (error) {
				console.error('Error searching memory:', error);
			}
		});

	program
		.command('diff')
		.description('Show differences between two files')
		.argument('<file1>', 'First file')
		.argument('<file2>', 'Second file')
		.action(async (file1, file2) => {
			try {
				console.log(`Comparing ${file1} with ${file2}`);

				const content1 = await fileManager.readFile(file1);
				const content2 = await fileManager.readFile(file2);

				const diff = await fileManager.calculateDiff(content1, content2);

				console.log('\nDifference Analysis:');
				console.log('-------------------');
				console.log(`Lines Added: ${diff.added}`);
				console.log(`Lines Removed: ${diff.removed}`);
				console.log(`Lines Changed: ${diff.changed}`);

				// Store the diff operation in memory
				await memoryManager.storeFileOperation(
					`${file1} -> ${file2}`,
					'modify',
					JSON.stringify(diff),
					{
						size_bytes: Math.abs(content2.length - content1.length),
						lines_changed: diff.changed
					}
				);
			} catch (error) {
				console.error('Error calculating diff:', error);
			}
		});
}
