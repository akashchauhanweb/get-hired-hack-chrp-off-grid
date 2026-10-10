import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Editorial stack: Fraunces (playful display serif) + Archivo (grotesque) + Plex Mono (technical).
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/900.css'
import '@fontsource/fraunces/400-italic.css'
import '@fontsource/fraunces/600-italic.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import './styles/index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
