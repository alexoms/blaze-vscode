/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

/**
 * Custom commands for the Blaze Chat extension
 */
export class BlazeCustomCommands {
	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService
	) { }

	/**
	 * Modify test.py to add a print statement for the variable on line 3
	 */
	public async modifyTestPy(): Promise<string> {
		this.logService.info('BlazeCustomCommands: Modifying test.py');

		try {
			// Find the test.py file in the workspace
			const workspaceFolders = this.workspaceService.getWorkspace().folders;
			if (!workspaceFolders.length) {
				return 'Error: No workspace folders found. Please open a folder or workspace first.';
			}

			// Try to find test.py in any of the workspace folders
			let fileUri: URI | undefined;
			for (const folder of workspaceFolders) {
				const candidateUri = URI.joinPath(folder.uri, 'test.py');
				try {
					const stat = await this.fileService.stat(candidateUri);
					if (stat.isFile) {
						fileUri = candidateUri;
						this.logService.info(`BlazeCustomCommands: Found test.py at ${candidateUri.toString()}`);
						break;
					}
				} catch (e) {
					// File not found in this folder, try the next one
				}
			}

			if (!fileUri) {
				return 'Error: Could not find test.py in the workspace. Please create a test.py file first.';
			}

			// Read the file content
			const fileContent = await this.fileService.readFile(fileUri);
			const content = fileContent.value.toString();
			this.logService.info(`BlazeCustomCommands: Successfully read test.py, ${content.length} characters`);

			// Split the content into lines
			const lines = content.split('\n');

			// Check if we have at least 3 lines
			if (lines.length < 4) {
				return 'Error: test.py does not have enough lines. It should have at least 4 lines.';
			}

			// Get line 3 (index 3 since arrays are 0-indexed)
			const line3 = lines[3];
			this.logService.info(`BlazeCustomCommands: Line 3 content: ${line3}`);

			// Extract variable name using regex
			const varMatch = line3.match(/(\w+)\s*=/);
			if (!varMatch || !varMatch[1]) {
				return 'Error: Could not find a variable definition in line 3 of test.py.';
			}

			const varName = varMatch[1];
			this.logService.info(`BlazeCustomCommands: Found variable ${varName} on line 3`);

			// Add print statement after line 3
			lines.splice(4, 0, `print(f"The value of ${varName} is: {${varName}}")`);

			// Create the modified content
			const newContent = lines.join('\n');

			// Create a temporary file for the modified content
			const tempFileName = `test.py.proposed.${Date.now()}`;
			const tempFileUri = URI.joinPath(fileUri.with({ path: fileUri.path.substring(0, fileUri.path.lastIndexOf('/')) }), tempFileName);

			// Write the modified content to the temporary file
			const buffer = VSBuffer.fromString(newContent);
			await this.fileService.writeFile(tempFileUri, buffer);

			return `I've created a modified version of test.py with a print statement for the variable '${varName}' defined on line 3.\n\nThe modified file is at: ${tempFileName}\n\nHere's what I added:\n\`\`\`python\nprint(f"The value of ${varName} is: {${varName}}")\n\`\`\`\n\nYou can review the changes and apply them to test.py if they look good.`;
		} catch (error) {
			this.logService.error('BlazeCustomCommands: Error modifying test.py', error);
			return `Error: Could not modify test.py. ${error.message}`;
		}
	}
}
