/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { basename } from '../../../../base/common/resources.js';

/**
 * Interface for file modification operations
 */
export interface FileModificationOptions {
	filePath: string;
	modification: (content: string) => string | Promise<string>;
	description: string;
}

/**
 * Generic command to modify any file in the workspace
 */
export async function modifyFileCommand(accessor: ServicesAccessor, options: FileModificationOptions): Promise<string> {
	const fileService = accessor.get(IFileService);
	const workspaceService = accessor.get(IWorkspaceContextService);
	const logService = accessor.get(ILogService);
	const editorService = accessor.get(IEditorService);
	const quickInputService = accessor.get(IQuickInputService);

	logService.info(`BlazeCommands: Modifying file ${options.filePath}`);

	try {
		// Find the file in the workspace
		const workspaceFolders = workspaceService.getWorkspace().folders;
		if (!workspaceFolders.length) {
			return 'Error: No workspace folders found. Please open a folder or workspace first.';
		}

		// Try to find the file in any of the workspace folders
		let fileUri: URI | undefined;
		for (const folder of workspaceFolders) {
			const candidateUri = URI.joinPath(folder.uri, options.filePath);
			try {
				const stat = await fileService.stat(candidateUri);
				if (stat.isFile) {
					fileUri = candidateUri;
					logService.info(`BlazeCommands: Found ${options.filePath} at ${candidateUri.toString()}`);
					break;
				}
			} catch (e) {
				// File not found in this folder, try the next one
			}
		}

		if (!fileUri) {
			return `Error: Could not find ${options.filePath} in the workspace.`;
		}

		// Read the file content
		const fileContent = await fileService.readFile(fileUri);
		const content = fileContent.value.toString();
		logService.info(`BlazeCommands: Successfully read ${options.filePath}, ${content.length} characters`);

		// Apply the modification function to the content
		const newContent = await options.modification(content);

		if (newContent === content) {
			return `No changes were made to ${options.filePath}.`;
		}

		// Ask user if they want to apply the changes directly
		const fileName = basename(fileUri);
		const applyDirectly = await quickInputService.pick(
			[
				{ label: `Apply changes directly to ${fileName}`, value: true },
				{ label: 'Create a temporary file with changes', value: false }
			],
			{ placeHolder: 'How would you like to apply the changes?' }
		);

		if (applyDirectly?.value) {
			// Write the changes directly to the file
			const buffer = VSBuffer.fromString(newContent);
			await fileService.writeFile(fileUri, buffer);

			// Open the file in the editor
			await editorService.openEditor({ resource: fileUri });

			return `Successfully modified ${fileName}: ${options.description}`;
		} else {
			// Create a temporary file for the modified content
			const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : '';
			const tempFileName = `${fileName.split('.')[0]}.proposed.${Date.now()}${fileExtension ? '.' + fileExtension : ''}`;
			const tempFileUri = URI.joinPath(fileUri.with({ path: fileUri.path.substring(0, fileUri.path.lastIndexOf('/')) }), tempFileName);

			// Write the modified content to the temporary file
			const buffer = VSBuffer.fromString(newContent);
			await fileService.writeFile(tempFileUri, buffer);

			// Open the temporary file in the editor
			await editorService.openEditor({ resource: tempFileUri });

			return `Created a modified version of ${fileName} with the following changes: ${options.description}\nThe modified file is at: ${tempFileName}`;
		}
	} catch (error) {
		logService.error(`BlazeCommands: Error modifying ${options.filePath}`, error);
		return `Error: Could not modify ${options.filePath}. ${error.message}`;
	}
}

/**
 * Command to modify a Python file by adding a print statement for a variable on a specific line
 */
export async function addPrintStatementCommand(accessor: ServicesAccessor, filePath: string, lineNumber: number): Promise<string> {
	return modifyFileCommand(accessor, {
		filePath,
		description: `Added print statement for variable on line ${lineNumber}`,
		modification: (content: string) => {
			// Split the content into lines
			const lines = content.split('\n');

			// Check if we have enough lines
			if (lines.length < lineNumber) {
				throw new Error(`File does not have enough lines. It should have at least ${lineNumber} lines.`);
			}

			// Get the target line (0-indexed array)
			const targetLine = lines[lineNumber - 1];

			// Extract variable name using regex
			const varMatch = targetLine.match(/(\w+)\s*=/);
			if (!varMatch || !varMatch[1]) {
				throw new Error(`Could not find a variable definition in line ${lineNumber}.`);
			}

			const varName = varMatch[1];

			// Add print statement after the target line
			lines.splice(lineNumber, 0, `print(f"The value of ${varName} is: {${varName}}")`);

			// Create the modified content
			return lines.join('\n');
		}
	});
}
