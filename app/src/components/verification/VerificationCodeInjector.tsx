/**
 * Verification Code Injector
 * 
 * Injects trusted admin-entered verification/partner code into controlled
 * locations on the live site.
 * 
 * SECURITY NOTE: This renders raw HTML. The safety comes from:
 * - Admin-only management in the dashboard
 * - Limited to controlled placements (head, footer, body_end)
 * - Disabled by default
 * - Only enabled code renders
 * 
 * This component should be mounted high in the app tree to ensure
 * the injection happens before the relevant sections render.
 */

import { useEffect, useState } from 'react';
import {
  getEnabledVerificationCode,
  type VerificationPlacement,
} from '@/lib/verification/api';

interface VerificationCodeInjectorProps {
  /**
   * Which placement to inject code for.
   * - 'head': Injected into document head (via DOM manipulation)
   * - 'footer': Injected before closing body tag (via DOM manipulation)
   * - 'body_end': Rendered as HTML at component location
   */
  placement: VerificationPlacement;
}

/**
 * Component that injects verification code into the page.
 * 
 * Usage:
 * - Mount <VerificationCodeInjector placement="head" /> in App.tsx
 *   It will inject code into document.head
 * - Mount <VerificationCodeInjector placement="footer" /> near the footer
 *   It will inject code before the closing body tag
 * - Mount <VerificationCodeInjector placement="body_end" /> at the end of body
 *   It will render the code as HTML
 */
export function VerificationCodeInjector({ placement }: VerificationCodeInjectorProps) {
  const [code, setCode] = useState<string>('');

  useEffect(() => {
    // Fetch and inject the verification code
    const injectCode = async () => {
      const enabledCode = await getEnabledVerificationCode(placement, 'production');
      
      if (!enabledCode?.trim()) {
        return;
      }

      setCode(enabledCode);

      // Inject based on placement type
      switch (placement) {
        case 'head':
          injectIntoHead(enabledCode);
          break;
        case 'footer':
          // Footer injection happens via DOM manipulation before </body>
          injectBeforeBodyEnd(enabledCode);
          break;
        case 'body_end':
          // body_end just renders the code directly in the component
          break;
      }
    };

    injectCode();
  }, [placement]);

  // For body_end placement, render the code directly
  if (placement === 'body_end' && code) {
    return <div dangerouslySetInnerHTML={{ __html: code }} />;
  }

  // For head/footer, no visible rendering
  return null;
}

/**
 * Injects code into the document head.
 * Parses the HTML string and appends elements to document.head.
 */
function injectIntoHead(htmlCode: string): void {
  if (typeof document === 'undefined') return;

  try {
    // Create a temporary container to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlCode;

    // Move all child elements to head
    while (tempDiv.firstChild) {
      const node = tempDiv.firstChild;
      
      // Skip text nodes (whitespace)
      if (node.nodeType === Node.TEXT_NODE) {
        tempDiv.removeChild(node);
        continue;
      }

      // Clone the node for head injection
      const clonedNode = node.cloneNode(true);
      document.head.appendChild(clonedNode);
      tempDiv.removeChild(node);
    }
  } catch (error) {
    console.error('Error injecting code into head:', error);
  }
}

/**
 * Injects code before the closing body tag.
 * Creates a container div and appends it to body.
 */
function injectBeforeBodyEnd(htmlCode: string): void {
  if (typeof document === 'undefined') return;

  try {
    // Create a container for the footer code
    const container = document.createElement('div');
    container.id = 'verification-code-footer';
    container.innerHTML = htmlCode;
    
    // Append to body (will be near the end)
    document.body.appendChild(container);
  } catch (error) {
    console.error('Error injecting code before body end:', error);
  }
}

/**
 * Hook to get verification code for a placement.
 * Useful for components that need to know if code is injected.
 */
export function useVerificationCode(placement: VerificationPlacement): {
  code: string;
  isLoading: boolean;
} {
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCode = async () => {
      setIsLoading(true);
      const enabledCode = await getEnabledVerificationCode(placement, 'production');
      setCode(enabledCode);
      setIsLoading(false);
    };

    fetchCode();
  }, [placement]);

  return { code, isLoading };
}
