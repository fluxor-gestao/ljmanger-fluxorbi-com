import { Link, type LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<LinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  children?: React.ReactNode;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, ...props }, ref) => {
    return (
      <Link
        ref={ref as never}
        {...(props as LinkProps)}
        className={cn(className)}
        activeProps={activeClassName ? { className: activeClassName } : undefined}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
