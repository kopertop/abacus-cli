import * as duckdb from 'duckdb';
import { join } from 'path';
import { mkdir } from 'fs/promises';

type QueryResult<T> = Promise<T>;

export class MemoryManager {
	private db!: duckdb.Database;
	private conn!: duckdb.Connection;

	constructor() {
		this.initializeDatabase();
	}

	private async initializeDatabase() {
		const abacusDir = join(process.cwd(), '.abacus');
		await mkdir(abacusDir, { recursive: true });

		const dbPath = join(abacusDir, 'memory.db');
		this.db = new duckdb.Database(dbPath);
		this.conn = this.db.connect();

		await this.initializeTables();
	}

	private async initializeTables() {
		return new Promise<void>((resolve, reject) => {
			this.conn.run(`
				CREATE TABLE IF NOT EXISTS code_context (
					id INTEGER PRIMARY KEY,
					file_path VARCHAR,
					content TEXT,
					last_modified TIMESTAMP,
					tags VARCHAR[]
				);

				CREATE TABLE IF NOT EXISTS conversations (
					id INTEGER PRIMARY KEY,
					timestamp TIMESTAMP,
					context_id INTEGER,
					prompt TEXT,
					response TEXT,
					metadata STRUCT(
						model VARCHAR,
						tokens_used INTEGER,
						duration_ms INTEGER
					),
					FOREIGN KEY (context_id) REFERENCES code_context(id)
				);

				CREATE TABLE IF NOT EXISTS file_history (
					id INTEGER PRIMARY KEY,
					file_path VARCHAR,
					operation VARCHAR,
					timestamp TIMESTAMP,
					diff TEXT,
					metadata STRUCT(
						size_bytes INTEGER,
						lines_changed INTEGER
					)
				);
			`, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async storeCodeContext(filePath: string, content: string, tags: string[] = []): Promise<number> {
		return new Promise((resolve, reject) => {
			this.conn.all(`
				INSERT INTO code_context (file_path, content, last_modified, tags)
				VALUES (?, ?, CURRENT_TIMESTAMP, ?)
				RETURNING id
			`, [filePath, content, tags], (err, result) => {
				if (err) reject(err);
				else resolve(result[0].id);
			});
		});
	}

	async getCodeContext(filePath: string): QueryResult<any[]> {
		return new Promise((resolve, reject) => {
			this.conn.all(`
				SELECT * FROM code_context
				WHERE file_path = ?
				ORDER BY last_modified DESC
				LIMIT 1
			`, [filePath], (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
		});
	}

	async storeConversation(
		contextId: number,
		prompt: string,
		response: string,
		metadata: { model: string; tokens_used: number; duration_ms: number }
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.conn.run(`
				INSERT INTO conversations (
					timestamp,
					context_id,
					prompt,
					response,
					metadata
				)
				VALUES (
					CURRENT_TIMESTAMP,
					?,
					?,
					?,
					{
						'model': ?,
						'tokens_used': ?,
						'duration_ms': ?
					}
				)
			`, [contextId, prompt, response, metadata.model, metadata.tokens_used, metadata.duration_ms],
			(err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async storeFileOperation(
		filePath: string,
		operation: 'create' | 'modify' | 'delete',
		diff: string,
		metadata: { size_bytes: number; lines_changed: number }
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.conn.run(`
				INSERT INTO file_history (
					file_path,
					operation,
					timestamp,
					diff,
					metadata
				)
				VALUES (
					?,
					?,
					CURRENT_TIMESTAMP,
					?,
					{
						'size_bytes': ?,
						'lines_changed': ?
					}
				)
			`, [filePath, operation, diff, metadata.size_bytes, metadata.lines_changed],
			(err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async searchMemory(query: string): QueryResult<any[]> {
		return new Promise((resolve, reject) => {
			this.conn.all(`
				SELECT
					c.file_path,
					c.content,
					c.tags,
					conv.prompt,
					conv.response,
					conv.metadata
				FROM code_context c
				LEFT JOIN conversations conv ON c.id = conv.context_id
				WHERE
					c.content ILIKE '%' || ? || '%'
					OR conv.prompt ILIKE '%' || ? || '%'
					OR conv.response ILIKE '%' || ? || '%'
				ORDER BY c.last_modified DESC
				LIMIT 10
			`, [query, query, query], (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
		});
	}

	async close(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.conn.close((err) => {
				if (err) reject(err);
				else {
					this.db.close((err) => {
						if (err) reject(err);
						else resolve();
					});
				}
			});
		});
	}
}
