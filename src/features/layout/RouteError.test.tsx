import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RouteErrorView } from './RouteError'

test('la pantalla de error está en español y ofrece recargar', () => {
  render(<RouteErrorView />)
  expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
})
