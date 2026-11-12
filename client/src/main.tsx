import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Preview } from './ui/Preview';
import './styles.css';

const preview = new URLSearchParams(location.search).get('preview');
if (!preview) void import('./net/socket');
createRoot(document.getElementById('root')!).render(preview ? <Preview mapId={preview} /> : <App />);
