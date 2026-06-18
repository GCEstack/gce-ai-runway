interface AuroraBackgroundProps {
  intense?: boolean
}

export function AuroraBackground({ intense = false }: AuroraBackgroundProps) {
  return (
    <div
      className={`aurora-bg ${intense ? 'aurora-bg-intense' : ''}`}
      aria-hidden="true"
    />
  )
}
