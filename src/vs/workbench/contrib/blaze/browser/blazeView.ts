/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

export class BlazeView extends Disposable {
	public static readonly ID = 'workbench.view.blaze';
	public static readonly TITLE = localize('blaze', "Blaze");
}
