/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Import only what we need
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import * as DOM from '../../../../base/browser/dom.js';
import {
	IViewPaneOptions,
	ViewPane,
} from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { BlazeView } from './blazeView.js';
import {
	IChatAccessibilityService,
	IChatWidget,
	IChatWidgetService,
} from '../../chat/browser/chat.js';
import { ChatWidget } from '../../chat/browser/chatWidget.js';
import { ChatAgentLocation, ChatMode } from '../../chat/common/constants.js';
import { IChatService } from '../../chat/common/chatService.js';
import { BlazeRestChatService } from './blazeRestChatService.js';
import { IChatAgentService } from '../../chat/common/chatAgents.js';
import {
	IStorageService,
	StorageScope,
	StorageTarget,
} from '../../../../platform/storage/common/storage.js';
import { Memento } from '../../../common/memento.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IChatSlashCommandService } from '../../chat/common/chatSlashCommands.js';
import { IChatEditingService } from '../../chat/common/chatEditingService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';

interface IBlazeViewPaneState {
	sessionId?: string;
	inputValue?: string;
	inputState?: {
		chatMode?: ChatMode;
	};
}

export class BlazeViewPane extends ViewPane {
	static readonly ID = BlazeView.ID;

	private _widget!: ChatWidget;
	get widget(): IChatWidget {
		return this._widget;
	}

	private readonly disposables = this._register(new DisposableStore());
	private memento: Memento;
	// Store viewState for future persistence features
	// @ts-ignore - We're not using this yet but will need it for future persistence
	private readonly viewState: IBlazeViewPaneState;
	protected override readonly instantiationService: IInstantiationService;
	private blazeRestChatService: BlazeRestChatService;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IStorageService private readonly storageService: IStorageService,
		// We're using direct REST API calls instead of the chat service
		// @ts-ignore - Not currently used but kept for future integration
		@IChatService private readonly chatService: IChatService,
		@IChatAgentService chatAgentService: IChatAgentService,
		@ILogService private readonly logService: ILogService,
		@ILayoutService layoutService: ILayoutService,
		@IChatWidgetService chatWidgetService: IChatWidgetService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IChatSlashCommandService chatSlashCommandService: IChatSlashCommandService,
		@IChatEditingService chatEditingService: IChatEditingService,
		@IChatAccessibilityService
		chatAccessibilityService: IChatAccessibilityService,
		@ICodeEditorService codeEditorService: ICodeEditorService,
	) {
		super(
			options,
			keybindingService,
			contextMenuService,
			configurationService,
			contextKeyService,
			viewDescriptorService,
			instantiationService,
			openerService,
			themeService,
			hoverService,
		);

		this.instantiationService = instantiationService;

		// Initialize memento for state persistence
		this.memento = new Memento('blaze-view', this.storageService);
		this.viewState = this.memento.getMemento(
			StorageScope.WORKSPACE,
			StorageTarget.MACHINE,
		) as IBlazeViewPaneState;

		// Initialize the Blaze REST chat service
		this.blazeRestChatService =
			instantiationService.createInstance(BlazeRestChatService);
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);

		// Log the start of rendering
		this.logService.info(
			'BlazeViewPane: Starting renderBody with HIGH VISIBILITY UI',
		);

		// Clear the parent element first to avoid duplicates
		while (parent.firstChild) {
			parent.removeChild(parent.firstChild);
		}

		// Create a main container
		const container = document.createElement('div');
		container.className = 'blaze-container';
		container.setAttribute('data-blaze-container', 'true');
		container.style.height = '100%';
		container.style.width = '100%';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.backgroundColor = '#0f2942'; // Darker blue background to match header
		container.style.overflow = 'hidden';
		parent.appendChild(container);

		// Add a header with dark blue styling
		const header = document.createElement('div');
		header.className = 'blaze-header';
		header.style.padding = '10px';
		header.style.backgroundColor = '#1a365d'; // Dark blue color
		header.style.color = 'white';
		header.style.fontWeight = 'bold';
		header.style.fontSize = '18px';
		header.style.textAlign = 'center';
		header.style.borderBottom = '2px solid #4299e1'; // Lighter blue border
		header.textContent = 'BLAZE';
		container.appendChild(header);

		// Create a messages container with dark blue styling
		const messagesContainer = document.createElement('div');
		messagesContainer.className = 'blaze-messages-container';
		messagesContainer.setAttribute('data-blaze-messages', 'true');
		messagesContainer.style.flex = '1';
		messagesContainer.style.backgroundColor = '#1e3a5f'; // Slightly lighter than the header
		messagesContainer.style.padding = '15px';
		messagesContainer.style.display = 'flex';
		messagesContainer.style.flexDirection = 'column';
		messagesContainer.style.gap = '10px';
		messagesContainer.style.overflow = 'auto';
		messagesContainer.style.margin = '10px';
		messagesContainer.style.borderRadius = '5px';
		messagesContainer.style.border = '2px solid #4299e1'; // Matching blue border
		container.appendChild(messagesContainer);

		// Add a welcome message
		const welcomeMessage = document.createElement('div');
		welcomeMessage.className = 'blaze-message';
		welcomeMessage.textContent =
			'Welcome to Blaze Chat! Type your message below.';
		welcomeMessage.style.backgroundColor = '#2c4a7c'; // Slightly darker blue for contrast
		welcomeMessage.style.padding = '10px';
		welcomeMessage.style.borderRadius = '5px';
		welcomeMessage.style.fontWeight = 'bold';
		welcomeMessage.style.color = 'white';
		welcomeMessage.style.borderLeft = '3px solid #63b3ed'; // Light blue accent
		messagesContainer.appendChild(welcomeMessage);

		// Create an input container with dark blue styling
		const inputContainer = document.createElement('div');
		inputContainer.className = 'blaze-input-container';
		inputContainer.style.display = 'flex';
		inputContainer.style.gap = '10px';
		inputContainer.style.padding = '10px';
		inputContainer.style.backgroundColor = '#1e3a5f'; // Matching the messages container
		inputContainer.style.margin = '10px';
		inputContainer.style.borderRadius = '5px';
		inputContainer.style.border = '2px solid #63b3ed';
		container.appendChild(inputContainer);

		// Add an input field with dark blue styling
		const inputField = document.createElement('input');
		inputField.className = 'blaze-input-field';
		inputField.type = 'text';
		inputField.placeholder = 'Type your message here...';
		inputField.style.flex = '1';
		inputField.style.padding = '10px';
		inputField.style.borderRadius = '5px';
		inputField.style.border = '1px solid #4299e1'; // Matching blue border
		inputField.style.backgroundColor = '#2c4a7c'; // Slightly darker blue for contrast
		inputField.style.color = 'white';
		inputField.style.fontSize = '14px';
		inputContainer.appendChild(inputField);

		// Add a send button with dark blue styling
		const sendButton = document.createElement('button');
		sendButton.className = 'blaze-send-button';
		sendButton.textContent = 'SEND';
		sendButton.style.padding = '10px 20px';
		sendButton.style.backgroundColor = '#3182ce'; // Bright blue button
		sendButton.style.color = 'white';
		sendButton.style.border = '1px solid #4299e1';
		sendButton.style.borderRadius = '5px';
		sendButton.style.fontWeight = 'bold';
		sendButton.style.cursor = 'pointer';
		inputContainer.appendChild(sendButton);

		// Add event listeners
		sendButton.addEventListener('click', () => {
			const text = inputField.value.trim();
			if (text) {
				// Use the widget's acceptInput method to send the message
				this._widget.acceptInput(text);
				// Clear the input field
				inputField.value = '';
			}
		});

		inputField.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				sendButton.click();
			}
		});

		// Add model selector area at the bottom
		const modelContainer = document.createElement('div');
		modelContainer.className = 'blaze-model-container';
		modelContainer.style.display = 'flex';
		modelContainer.style.alignItems = 'center';
		modelContainer.style.justifyContent = 'space-between';
		modelContainer.style.padding = '5px';
		modelContainer.style.backgroundColor = '#1e392a';
		modelContainer.style.margin = '10px';
		modelContainer.style.borderRadius = '5px';
		modelContainer.style.border = '1px solid #38a169';
		container.appendChild(modelContainer);

		// Add status text
		const statusText = document.createElement('span');
		statusText.textContent = 'ACTIVE';
		statusText.style.color = '#4CAF50';
		statusText.style.fontWeight = 'bold';
		modelContainer.appendChild(statusText);

		// Create model selector with dark green styling
		const modelSelectorContainer = document.createElement('div');
		modelSelectorContainer.style.display = 'flex';
		modelSelectorContainer.style.alignItems = 'center';
		modelSelectorContainer.style.backgroundColor = '#1e392a'; // Dark green background
		modelSelectorContainer.style.padding = '5px 10px';
		modelSelectorContainer.style.borderRadius = '3px';
		modelSelectorContainer.style.border = '1px solid #38a169'; // Green border
		modelContainer.appendChild(modelSelectorContainer);

		// Add label for model selector
		const modelLabel = document.createElement('label');
		modelLabel.textContent = 'Model: ';
		modelLabel.style.color = 'white';
		modelLabel.style.marginRight = '5px';
		modelSelectorContainer.appendChild(modelLabel);

		// Create the select element with green styling
		const modelSelector = document.createElement('select');
		modelSelector.className = 'blaze-model-selector';
		modelSelector.style.padding = '5px';
		modelSelector.style.border = '1px solid #38a169'; // Green border
		modelSelector.style.borderRadius = '3px';
		modelSelector.style.backgroundColor = '#2d513d'; // Medium dark green
		modelSelector.style.color = 'white';
		modelSelectorContainer.appendChild(modelSelector);

		// Add model options
		const claudeOption = document.createElement('option');
		claudeOption.value = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';
		claudeOption.textContent = 'Claude 3.7 Sonnet';
		modelSelector.appendChild(claudeOption);

		const novaOption = document.createElement('option');
		novaOption.value = 'us.amazon.nova-lite-v1:0';
		novaOption.textContent = 'Nova Lite';
		modelSelector.appendChild(novaOption);



		// Log that we've created the UI
		this.logService.info('BlazeViewPane: Created high visibility UI');

		// Create a minimal widget for compatibility with the rest of the code
		const scopedInstantiationService = this.instantiationService.createChild(
			new ServiceCollection(),
		);

		// Create a minimal chat widget just for compatibility
		this._widget = this._register(
			scopedInstantiationService.createInstance(
				ChatWidget,
				ChatAgentLocation.Panel, // location
				undefined, // viewContext
				{
					// viewOptions
					renderInputOnTop: false,
					renderStyle: 'compact',
				},
				{
					// styles
					inputEditorBackground: 'var(--vscode-input-background)',
					resultEditorBackground: 'var(--vscode-editor-background)',
					overlayBackground: 'var(--vscode-editor-background)',
					listForeground: 'var(--vscode-foreground)',
					listBackground: 'var(--vscode-sideBar-background)',
				},
			),
		);

		// The widget will be hidden by our custom UI naturally

		// Override the accept input method to completely bypass the original method
		this._widget.acceptInput = async (query?: string) => {
			// Add debug logging
			this.logService.info(
				'BlazeViewPane: acceptInput called with query:',
				query,
			);

			if (!query) {
				try {
					query = this._widget.getInput();
					this.logService.info(
						'BlazeViewPane: Using input from widget:',
						query,
					);
				} catch (error) {
					this.logService.error(
						'BlazeViewPane: Error getting input from widget:',
						error,
					);
				}
			}

			if (!query) {
				this.logService.info('BlazeViewPane: No query to send');
				return undefined;
			}

			// Clear the input - safely
			try {
				this._widget.setInput('');
			} catch (error) {
				this.logService.error('BlazeViewPane: Error clearing input:', error);
				// This is non-critical, we can continue
			}

			// Find the messages container using the element's window to support multi-window scenarios
			const targetWindow = this.element.ownerDocument.defaultView;
			if (!targetWindow) {
				this.logService.error('BlazeViewPane: Could not find target window');
				return undefined;
			}

			// Use the target window's document to query for the messages container
			const messagesContainer = targetWindow.document.querySelector(
				'.blaze-messages-container',
			) as HTMLElement;
			if (!messagesContainer) {
				this.logService.error(
					'BlazeViewPane: Could not find messages container',
				);
				return undefined;
			}

			// Add user message
			const userMessage = document.createElement('div');
			userMessage.className = 'blaze-user-message';
			userMessage.textContent = `You: ${query}`;
			userMessage.style.backgroundColor = '#444';
			userMessage.style.padding = '10px';
			userMessage.style.borderRadius = '5px';
			userMessage.style.marginBottom = '10px';
			userMessage.style.color = 'white';
			messagesContainer.appendChild(userMessage);

			// Show loading indicator
			const loadingMessage = document.createElement('div');
			loadingMessage.className = 'blaze-loading-message';
			loadingMessage.textContent = 'Blaze is thinking...';
			loadingMessage.style.backgroundColor = '#444';
			loadingMessage.style.padding = '10px';
			loadingMessage.style.borderRadius = '5px';
			loadingMessage.style.borderLeft = '3px solid #ff5722';
			loadingMessage.style.color = 'white';
			loadingMessage.style.fontStyle = 'italic';
			messagesContainer.appendChild(loadingMessage);

			// Scroll to bottom
			messagesContainer.scrollTop = messagesContainer.scrollHeight;

			try {
				// Get response from REST API
				// Get selected model from dropdown
				let selectedModel = 'us.amazon.nova-lite-v1:0'; // Default model
				const modelSelector = targetWindow.document.querySelector(
					'.blaze-model-selector',
				) as HTMLSelectElement;
				if (modelSelector) {
					selectedModel = modelSelector.value;
				}

				// Get response from REST API with selected model
				const response = await this.blazeRestChatService.getResponseFromRestApi(
					query,
					selectedModel,
				);

				// Remove loading message
				messagesContainer.removeChild(loadingMessage);

				// Add response message with markdown rendering
				const responseMessage = document.createElement('div');
				responseMessage.className = 'blaze-response-message';
				responseMessage.style.backgroundColor = '#444';
				responseMessage.style.padding = '10px';
				responseMessage.style.borderRadius = '5px';
				responseMessage.style.borderLeft = '3px solid #ff5722';
				responseMessage.style.color = 'white';
				responseMessage.style.whiteSpace = 'pre-wrap';

				// Process the response with pure DOM manipulation to avoid TrustedHTML issues
				const safeResponse =
					response || 'Sorry, I could not generate a response.';

				// Parse the response for code blocks using regex
				const codeBlockRegex = /```([\w]*)([\s\S]*?)```/g;
				let lastIndex = 0;
				let match;

				// Function to create a text node with safe content
				const createTextNode = (text: string) => {
					if (!text.trim()) {
						return null;
					}
					const textNode = document.createTextNode(text);
					const textSpan = document.createElement('span');
					textSpan.appendChild(textNode);
					return textSpan;
				};

				// Function to create a code block with copy button
				const createCodeBlock = (language: string, code: string) => {
					// Create container
					const codeBlock = document.createElement('div');
					codeBlock.className = 'blaze-code-block';
					codeBlock.style.backgroundColor = '#2d2d2d';
					codeBlock.style.borderRadius = '4px';
					codeBlock.style.margin = '10px 0';
					codeBlock.style.overflow = 'hidden';

					// Create header with language and copy button
					const headerDiv = document.createElement('div');
					headerDiv.className = 'blaze-code-header';
					headerDiv.style.backgroundColor = '#3d3d3d';
					headerDiv.style.padding = '4px 8px';
					headerDiv.style.display = 'flex';
					headerDiv.style.justifyContent = 'space-between';
					headerDiv.style.alignItems = 'center';

					// Add language indicator if present
					const langDiv = document.createElement('div');
					langDiv.className = 'blaze-code-language';
					langDiv.style.fontFamily = 'monospace';
					langDiv.style.fontSize = '12px';
					langDiv.style.color = '#ff5722';
					langDiv.textContent = language.trim() || 'code';
					headerDiv.appendChild(langDiv);

					// Add copy button
					const copyButton = document.createElement('button');
					copyButton.className = 'blaze-copy-button';
					copyButton.textContent = 'Copy';
					copyButton.style.backgroundColor = '#555';
					copyButton.style.color = 'white';
					copyButton.style.border = 'none';
					copyButton.style.borderRadius = '3px';
					copyButton.style.padding = '2px 8px';
					copyButton.style.fontSize = '11px';
					copyButton.style.cursor = 'pointer';
					copyButton.style.transition = 'background-color 0.2s';

					// Add hover effect
					copyButton.addEventListener('mouseover', () => {
						copyButton.style.backgroundColor = '#ff5722';
					});
					copyButton.addEventListener('mouseout', () => {
						copyButton.style.backgroundColor = '#555';
					});

					// Add click handler for copying code
					copyButton.addEventListener('click', () => {
						try {
							// Use VSCode's clipboard API via execCommand
							const textArea = document.createElement('textarea');
							textArea.value = code.trim();
							textArea.style.position = 'fixed';
							textArea.style.left = '-9999px';
							textArea.style.top = '-9999px';
							const targetWindow = DOM.getActiveWindow();
							targetWindow.document.body.appendChild(textArea);
							textArea.focus();
							textArea.select();

							const successful = targetWindow.document.execCommand('copy');
							targetWindow.document.body.removeChild(textArea);

							if (successful) {
								// Show success feedback
								const originalText = copyButton.textContent;
								copyButton.textContent = 'Copied!';
								copyButton.style.backgroundColor = '#4CAF50';

								// Reset after 2 seconds
								setTimeout(() => {
									copyButton.textContent = originalText;
									copyButton.style.backgroundColor = '#555';
								}, 2000);
							} else {
								// Show error feedback
								copyButton.textContent = 'Error!';
								copyButton.style.backgroundColor = '#f44336';

								// Reset after 2 seconds
								setTimeout(() => {
									copyButton.textContent = 'Copy';
									copyButton.style.backgroundColor = '#555';
								}, 2000);
							}
						} catch (error) {
							// Log error and show feedback
							this.logService.error('Error copying to clipboard:', error);
							copyButton.textContent = 'Error!';
							copyButton.style.backgroundColor = '#f44336';

							// Reset after 2 seconds
							setTimeout(() => {
								copyButton.textContent = 'Copy';
								copyButton.style.backgroundColor = '#555';
							}, 2000);
						}
					});

					headerDiv.appendChild(copyButton);
					codeBlock.appendChild(headerDiv);

					// Add code content
					const pre = document.createElement('pre');
					pre.className = 'blaze-code-content';
					pre.style.padding = '10px';
					pre.style.margin = '0';
					pre.style.backgroundColor = '#1e1e1e';
					pre.style.overflowX = 'auto';
					pre.style.fontFamily = 'monospace';
					pre.style.whiteSpace = 'pre';
					pre.textContent = code.trim();
					codeBlock.appendChild(pre);

					return codeBlock;
				};

				// Clear any existing content
				while (responseMessage.firstChild) {
					responseMessage.removeChild(responseMessage.firstChild);
				}

				// Process and append content
				try {
					// If no code blocks, just add the text
					if (!safeResponse.includes('```')) {
						responseMessage.textContent = safeResponse;
					} else {
						// Process code blocks and text segments
						while ((match = codeBlockRegex.exec(safeResponse)) !== null) {
							// Add text before code block
							if (match.index > lastIndex) {
								const textBefore = safeResponse.substring(
									lastIndex,
									match.index,
								);
								const textNode = createTextNode(textBefore);
								if (textNode) {
									responseMessage.appendChild(textNode);
								}
							}

							// Add code block
							const language = match[1].trim();
							const code = match[2].trim();
							const codeBlock = createCodeBlock(language, code);
							responseMessage.appendChild(codeBlock);

							// Update last index
							lastIndex = match.index + match[0].length;
						}

						// Add any remaining text
						if (lastIndex < safeResponse.length) {
							const textAfter = safeResponse.substring(lastIndex);
							const textNode = createTextNode(textAfter);
							if (textNode) {
								responseMessage.appendChild(textNode);
							}
						}
					}
				} catch (error) {
					// Fallback to plain text if there's an error
					this.logService.error('Error formatting response:', error);
					responseMessage.textContent = safeResponse;
				}

				// Add styles for code blocks
				const style = document.createElement('style');
				style.textContent = `
					.blaze-code-block {
						background-color: #2d2d2d;
						border-radius: 4px;
						margin: 10px 0;
						overflow: hidden;
					}
					.blaze-code-language {
						background-color: #3d3d3d;
						padding: 4px 8px;
						font-family: monospace;
						font-size: 12px;
						color: #ff5722;
					}
					.blaze-code-content {
						padding: 10px;
						margin: 0;
						background-color: #1e1e1e;
						overflow-x: auto;
						font-family: monospace;
						white-space: pre;
					}
				`;
				responseMessage.appendChild(style);

				messagesContainer.appendChild(responseMessage);

				// Scroll to bottom again
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			} catch (error) {
				// Remove loading message
				messagesContainer.removeChild(loadingMessage);

				// Add error message
				const errorMessage = document.createElement('div');
				errorMessage.className = 'blaze-error-message';
				errorMessage.textContent = `Error: Could not get response from API. ${error}`;
				errorMessage.style.backgroundColor = '#ff5722';
				errorMessage.style.padding = '10px';
				errorMessage.style.borderRadius = '5px';
				errorMessage.style.color = 'white';
				messagesContainer.appendChild(errorMessage);

				// Log the error
				this.logService.error(
					'BlazeViewPane: Error getting response from REST API',
					error,
				);
			}

			return undefined;
		};
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);

		// Layout the widget if it exists and has a layout method
		if (this._widget) {
			try {
				this._widget.layout(height, width);
			} catch (error) {
				// Silently ignore layout errors - they're not critical
				// This happens during initialization when the widget isn't fully ready
			}
		}
	}

	override dispose(): void {
		this.disposables.dispose();
		super.dispose();
	}
}
