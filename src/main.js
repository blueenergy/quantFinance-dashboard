import './assets/styles/stock-ranking-tokens.css';
import './assets/styles/design-tokens.css';
import './assets/styles/utilities.css';
import { createApp } from 'vue';
import App from './App.vue';

// Vuetify 3 setup
import 'vuetify/styles'; // Global CSS has to be imported
import { createVuetify } from 'vuetify';
// Explicit component/directive imports to avoid missing dropdown rendering
// Import only used Vuetify components/directives to improve tree-shaking
import {
	VApp, VRow, VCol, VSelect, VTextField, VBtn, VBtnToggle, VIcon, VChip, VCard, VCardText, VCardTitle, VCardActions,
	VDialog, VDataTable, VTextarea, VSpacer, VSwitch, VContainer, VListItem, VList, VTabs, VTab, VWindow, VWindowItem,
	VPagination, VForm, VListItemTitle, VListItemSubtitle, VMenu,
	// Add missing components for StrategyParamsEditor
	VTable, VTooltip, VAlert, VChipGroup,
	// Add components for LimitUpLadder
	VProgressLinear, VProgressCircular, VOverlay, VExpandTransition
} from 'vuetify/components';
import { Ripple } from 'vuetify/directives';
// Use SVG icon set to avoid loading large icon font
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

const vuetify = createVuetify({
	components: {
		VApp, VRow, VCol, VSelect, VTextField, VBtn, VBtnToggle, VIcon, VChip, VCard, VCardText, VCardTitle, VCardActions,
		VDialog, VDataTable, VTextarea, VSpacer, VSwitch, VContainer, VListItem, VList, VTabs, VTab, VWindow, VWindowItem,
		VPagination, VForm, VListItemTitle, VListItemSubtitle, VMenu,
		VTable, VTooltip, VAlert, VChipGroup,
		VProgressLinear, VProgressCircular, VOverlay, VExpandTransition
	},
	directives: { Ripple },
	icons: {
		defaultSet: 'mdi',
		aliases,
		sets: {
			mdi,
		},
	},
	theme: {
		defaultTheme: 'light',
		themes: {
			light: {
				colors: {
					primary: '#0466c8',
					secondary: '#ffb300',
					success: '#28a745',
					info: '#17a2b8',
				},
			},
		},
	},
});

const app = createApp(App);
app.use(vuetify);
app.mount('#app');
