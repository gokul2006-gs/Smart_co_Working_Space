import { useEffect, useRef } from "react";

export function useScrollReveal() {
  const cleanupRef = useRef<(() => void) | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasInitialized.current) return;
    hasInitialized.current = true;

    const startReveal = () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const revealElements = new Set<HTMLElement>();
      const revealSelector = [
        ".reveal",
        ".reveal-stagger",
        ".reveal-card",
        ".reveal-heading",
        ".reveal-text",
        ".reveal-button",
        ".reveal-image",
      ].join(", ");

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const target = entry.target as HTMLElement;
            if (!target) return;

            if (entry.isIntersecting) {
              target.classList.add("revealed");
              observer.unobserve(target);
            }
          });
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -15% 0px",
        },
      );

      const observeElement = (element: HTMLElement) => {
        if (revealElements.has(element)) return;
        revealElements.add(element);

        if (prefersReducedMotion) {
          element.classList.add("revealed");
        } else {
          observer.observe(element);
        }
      };

      const scan = (root: ParentNode = document.body) => {
        root.querySelectorAll<HTMLElement>(revealSelector).forEach(observeElement);
      };

      scan();

      const mutationObserver = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches(revealSelector)) observeElement(node);
            node.querySelectorAll<HTMLElement>(revealSelector).forEach(observeElement);
          });
        });
      });

      mutationObserver.observe(document.body, { childList: true, subtree: true });

      return () => {
        observer.disconnect();
        mutationObserver.disconnect();
      };
    };

    const frameId = window.requestAnimationFrame(() => {
      const timeoutId = window.setTimeout(() => {
        cleanupRef.current?.();
        cleanupRef.current = startReveal();
      }, 0);

      cleanupRef.current = () => {
        window.clearTimeout(timeoutId);
      };
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);
}
