import { render } from 'preact';
import { App } from './App';

const host = document.getElementById('app');
if (!host) throw new Error('Missing #app host');
render(<App />, host);
