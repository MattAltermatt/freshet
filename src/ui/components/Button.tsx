import type { ComponentChildren, JSX } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  children?: ComponentChildren;
}

export function Button({
  variant = 'secondary',
  children,
  class: className,
  disabled,
  onClick,
  ...rest
}: ButtonProps): JSX.Element {
  const handleClick: JSX.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (disabled) return;
    if (typeof onClick === 'function') onClick(event);
  };
  return (
    <button
      type="button"
      data-variant={variant}
      class={`pj-btn${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
}
