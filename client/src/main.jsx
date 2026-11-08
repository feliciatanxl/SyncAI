import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { createMsalInstance } from './auth/msal.js'
import App from './App.jsx'
import './styles/site.css'

const msal = await createMsalInstance()
const app = <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>{msal ? <MsalProvider instance={msal}>{app}</MsalProvider> : app}</StrictMode>,
)
