import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'


if ('serviceWorker' in navigator) {
  // Reload only when a new version replaces an old one, not when the first
  // service worker takes control (that would reset the page mid-questionnaire)
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
  });
}

const root = createRoot(document.getElementById('root')!)

// Page de test des briques du nouveau design : /?briques
if (new URLSearchParams(window.location.search).has('briques')) {
  document.getElementById('prerender')?.remove()
  import('./ui/Showcase.tsx').then(({ default: Showcase }) => root.render(<StrictMode><Showcase /></StrictMode>))
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
