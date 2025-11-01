import './assets/styles/stock-ranking-tokens.css';
import { createApp } from 'vue';
import App from './App.vue';

// Vuetify 3 setup
import 'vuetify/styles'; // Global CSS has to be imported
import { createVuetify } from 'vuetify';
// Explicit component/directive imports to avoid missing dropdown rendering
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import '@mdi/font/css/materialdesignicons.css';

const vuetify = createVuetify({
	components,
	directives,
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
