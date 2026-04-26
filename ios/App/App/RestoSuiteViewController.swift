import UIKit
import Capacitor
import WebKit

class RestoSuiteViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        let css = """
        .nav-bottom {
            height: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
            padding-bottom: env(safe-area-inset-bottom, 0px) !important;
            z-index: 999999 !important;
        }
        body {
            padding-top: env(safe-area-inset-top, 0px);
        }
        @media (min-width: 768px) {
            body {
                padding-top: 76px;
            }
        }
        """

        let js = """
        (function() {
            function injectFix() {
                if (document.getElementById('cap-nav-fix')) return;
                var s = document.createElement('style');
                s.id = 'cap-nav-fix';
                s.textContent = `\(css)`;
                document.head.appendChild(s);
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', injectFix);
            } else {
                injectFix();
            }
        })();
        """

        let userScript = WKUserScript(
            source: js,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        webView?.configuration.userContentController.addUserScript(userScript)

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.webView?.evaluateJavaScript(js)
        }
    }
}
