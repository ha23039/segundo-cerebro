import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('sin sesión muestra el login con el nombre de la app', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Segundo Cerebro' })).toBeInTheDocument()
  expect(screen.getByLabelText('Correo')).toBeInTheDocument()
})
