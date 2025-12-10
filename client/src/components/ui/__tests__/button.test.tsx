import { render, screen, fireEvent } from '@testing-library/react';
import { Button, buttonVariants } from '../button';
import '@testing-library/jest-dom';

describe('Button Component', () => {
  test('renders button with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
  });

  test('handles onClick events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary', 'text-primary-foreground');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive', 'text-destructive-foreground');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-secondary', 'text-secondary-foreground');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-transparent');

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-primary', 'underline-offset-4');
  });

  test('applies size classes correctly', () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('min-h-9', 'px-4', 'py-2');

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('min-h-8', 'px-3', 'text-xs');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('min-h-10', 'px-8');

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-9', 'w-9');
  });

  test('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
    // Should still have default classes
    expect(button).toHaveClass('inline-flex', 'items-center');
  });

  test('forwards refs correctly', () => {
    const ref = jest.fn();
    render(<Button ref={ref}>Ref test</Button>);
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  test('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
  });

  test('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveClass('inline-flex', 'items-center');
  });

  test('supports different HTML button types', () => {
    const { rerender } = render(<Button type="button">Button</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');

    rerender(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');

    rerender(<Button type="reset">Reset</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
  });

  test('combines multiple props correctly', () => {
    render(
      <Button 
        variant="outline" 
        size="lg" 
        className="custom-class"
        disabled
        type="submit"
      >
        Complex Button
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border'); // outline variant
    expect(button).toHaveClass('min-h-10', 'px-8'); // lg size
    expect(button).toHaveClass('custom-class'); // custom class
    expect(button).toBeDisabled(); // disabled
    expect(button).toHaveAttribute('type', 'submit'); // type
  });

  test('handles keyboard events', () => {
    const handleKeyDown = jest.fn();
    render(<Button onKeyDown={handleKeyDown}>Keyboard</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    
    expect(handleKeyDown).toHaveBeenCalledTimes(1);
    expect(handleKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'Enter',
        code: 'Enter',
      })
    );
  });

  test('renders children correctly', () => {
    render(
      <Button>
        <span>Icon</span>
        <span>Text</span>
      </Button>
    );
    
    expect(screen.getByText('Icon')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  test('has correct default variant and size', () => {
    render(<Button>Default</Button>);
    
    const button = screen.getByRole('button');
    // Default variant classes
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    // Default size classes
    expect(button).toHaveClass('min-h-9', 'px-4', 'py-2');
  });
});

describe('buttonVariants', () => {
  test('returns correct classes for variant combinations', () => {
    expect(buttonVariants({ variant: 'default', size: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'outline', size: 'sm' })).toContain('border');
    expect(buttonVariants({ variant: 'ghost', size: 'lg' })).toContain('border-transparent');
  });

  test('handles undefined props gracefully', () => {
    expect(buttonVariants()).toBeDefined();
    expect(buttonVariants({})).toBeDefined();
    expect(buttonVariants({ variant: undefined })).toBeDefined();
  });
});