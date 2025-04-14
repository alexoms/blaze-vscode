/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation } from '../../../common/views.js';
import { WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { BlazeView } from './blazeView.js';
import { BlazeViewPane } from './blazeViewPane.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { BlazeContribution } from './blazeContribution.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

// Register Blaze view container
const BLAZE_VIEW_CONTAINER_ID = 'workbench.view.blaze';
const viewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: BLAZE_VIEW_CONTAINER_ID,
	title: { value: localize('blazeChat', "Blaze Chat"), original: 'Blaze Chat' },
	icon: Codicon.comment,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [BLAZE_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: BLAZE_VIEW_CONTAINER_ID,
	hideIfEmpty: false,
	order: 100,
}, ViewContainerLocation.Panel);

// Register Blaze view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: BlazeView.ID,
	name: { value: localize('blazeChat', "Blaze Chat"), original: 'Blaze Chat' },
	canToggleVisibility: false,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(BlazeViewPane),
	when: undefined,
	order: 0,
}], viewContainer);

// Register Blaze action to show the view
registerAction2(class ShowBlazeViewAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.showBlazeView',
			title: { value: localize('showBlazeView', "Show Blaze"), original: 'Show Blaze' },
			category: { value: localize('blaze', "Blaze"), original: 'Blaze' },
			f1: true,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB,
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		// Focus the Blaze view
		viewsService.openView(BlazeView.ID, true);
	}
});

// Register the Blaze contribution
registerWorkbenchContribution2(
	BlazeContribution.ID,
	BlazeContribution,
	WorkbenchPhase.Eventually
);
