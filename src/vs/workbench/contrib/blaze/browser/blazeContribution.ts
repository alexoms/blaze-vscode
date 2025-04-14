/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { BlazeView } from './blazeView.js';

export class BlazeContribution extends Disposable implements IWorkbenchContribution {
	public static readonly ID = 'workbench.contrib.blaze';

	constructor(
		@IViewsService private readonly viewsService: IViewsService
	) {
		super();

		// Open the Blaze view when the contribution is initialized
		this.openBlazeView();
	}

	private async openBlazeView(): Promise<void> {
		// Open the Blaze view
		await this.viewsService.openView(BlazeView.ID, true);
	}
}
