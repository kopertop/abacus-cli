import { readFile, writeFile, stat } from 'fs/promises';
import { glob } from 'glob';
import { relative, join } from 'path';
import { createHash } from 'crypto';

export class FileManager {
	constructor(private readonly workingDirectory: string = process.cwd()) {}

	async readFile(path: string): Promise<string> {
		const fullPath = join(this.workingDirectory, path);
		return await readFile(fullPath, 'utf-8');
	}

	async writeFile(path: string, content: string): Promise<void> {
		const fullPath = join(this.workingDirectory, path);
		await writeFile(fullPath, content, 'utf-8');
	}

	async listFiles(pattern: string): Promise<string[]> {
		const files = await glob(pattern, {
			cwd: this.workingDirectory,
			ignore: ['node_modules/**', '.git/**', '.abacus/**'],
			absolute: false
		});
		return files;
	}

	async analyzeFile(path: string): Promise<{
		size: number;
		hash: string;
		lines: number;
	}> {
		const content = await this.readFile(path);
		const stats = await stat(join(this.workingDirectory, path));

		return {
			size: stats.size,
			hash: createHash('sha256').update(content).digest('hex'),
			lines: content.split('\n').length
		};
	}

	async findFiles(pattern: string): Promise<{
		path: string;
		type: string;
		size: number;
	}[]> {
		const files = await this.listFiles(pattern);
		const results = await Promise.all(
			files.map(async (file) => {
				const stats = await stat(join(this.workingDirectory, file));
				return {
					path: file,
					type: file.split('.').pop() || 'unknown',
					size: stats.size
				};
			})
		);

		return results;
	}

	async calculateDiff(oldContent: string, newContent: string): Promise<{
		added: number;
		removed: number;
		changed: number;
	}> {
		const oldLines = oldContent.split('\n');
		const newLines = newContent.split('\n');

		const added = newLines.filter(line => !oldLines.includes(line)).length;
		const removed = oldLines.filter(line => !newLines.includes(line)).length;
		const changed = Math.max(added, removed);

		return { added, removed, changed };
	}

	async analyzeDirectory(): Promise<{
		files: number;
		directories: number;
		totalSize: number;
		typeBreakdown: { [key: string]: number };
	}> {
		const files = await this.listFiles('**/*');
		const stats = {
			files: 0,
			directories: 0,
			totalSize: 0,
			typeBreakdown: {} as { [key: string]: number }
		};

		await Promise.all(
			files.map(async (file) => {
				const fileStat = await stat(join(this.workingDirectory, file));

				if (fileStat.isDirectory()) {
					stats.directories++;
				} else {
					stats.files++;
					stats.totalSize += fileStat.size;

					const ext = file.split('.').pop() || 'no-extension';
					stats.typeBreakdown[ext] = (stats.typeBreakdown[ext] || 0) + 1;
				}
			})
		);

		return stats;
	}
}
