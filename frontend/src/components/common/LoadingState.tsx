interface LoadingStateProps {
  label: string;
  skeleton?: boolean;
}

export default function LoadingState({ label, skeleton = false }: LoadingStateProps) {
  return (
    <div className={skeleton ? 'loading-state loading-state-panel' : 'loading-state'} role="status">
      <div className="loading-state-label">
        <span className="loading-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {skeleton && (
        <div className="loading-skeleton" aria-hidden="true">
          <div /><div /><div />
        </div>
      )}
    </div>
  );
}
