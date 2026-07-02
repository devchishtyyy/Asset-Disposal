/* Role-selection fetch interceptor — loaded before the main React bundle.
   Patches window.fetch so that when the login API returns requiresRoleSelection,
   a role-picker dialog is shown before the React app receives the response.
   The React app sees only the final { token, user } payload and behaves normally. */
(function () {
  'use strict';

  var _fetch = window.fetch;

  window.fetch = function (resource, options) {
    var url = '';
    if (typeof resource === 'string') {
      url = resource;
    } else if (resource && typeof resource.href === 'string') {
      url = resource.href;
    } else if (resource && typeof resource.url === 'string') {
      url = resource.url;
    }

    var method = ((options && options.method) || 'GET').toUpperCase();

    // Only intercept POST calls to the login endpoint
    if (method !== 'POST' || url.indexOf('/api/auth/login') === -1) {
      return _fetch(resource, options);
    }

    return _fetch(resource, options).then(function (response) {
      // Non-success (e.g. 401 wrong password) — pass through unchanged
      if (!response.ok) return response;

      // Read via clone so the original Response body is still available
      return response.clone().json().then(function (data) {
        if (!data || !data.requiresRoleSelection) return response;

        // Multi-role user: block the React app until they pick a role
        return showRolePicker(data).catch(function (err) {
          // On error or cancellation return a synthetic error the React app can display
          var msg = (err && err.message) || 'Role selection failed. Please log in again.';
          return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      }).catch(function () {
        // Body wasn't JSON — pass through as-is
        return response;
      });
    });
  };

  /* ── Role picker UI ──────────────────────────────────────────────────────── */

  function showRolePicker(data) {
    return new Promise(function (resolve, reject) {
      var roles = Array.isArray(data.availableRoles) ? data.availableRoles : [];
      if (roles.length === 0) {
        reject(new Error('No roles available.'));
        return;
      }

      /* Overlay */
      var overlay = el('div', {
        position: 'fixed',
        inset: '0',
        zIndex: '99999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        fontFamily: 'Inter,system-ui,-apple-system,sans-serif',
      });

      /* Dialog card */
      var dialog = el('div', {
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '32px 28px',
        width: '100%',
        maxWidth: '430px',
        margin: '16px',
        boxSizing: 'border-box',
        boxShadow: '0 32px 64px rgba(0,0,0,0.65)',
      });

      /* Header */
      var header = el('div', { textAlign: 'center', marginBottom: '26px' });

      var iconWrap = el('div', {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '54px',
        height: '54px',
        background: '#0c2a4a',
        borderRadius: '14px',
        marginBottom: '16px',
      });
      iconWrap.innerHTML = svgUser();
      header.appendChild(iconWrap);

      var title = el('h2', {
        margin: '0 0 8px',
        fontSize: '20px',
        fontWeight: '700',
        color: '#f1f5f9',
        lineHeight: '1.3',
      });
      title.textContent = 'Select Your Role';
      header.appendChild(title);

      var subtitle = el('p', {
        margin: '0',
        fontSize: '14px',
        color: '#94a3b8',
        lineHeight: '1.55',
      });
      subtitle.textContent = 'Your account has multiple roles. Choose how you would like to continue in this session.';
      header.appendChild(subtitle);
      dialog.appendChild(header);

      /* Role buttons */
      var buttons = [];
      roles.forEach(function (role, idx) {
        var btn = el('button', {
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          width: '100%',
          padding: '14px 16px',
          background: '#1e293b',
          border: '1.5px solid #334155',
          borderRadius: '10px',
          cursor: 'pointer',
          textAlign: 'left',
          color: '#e2e8f0',
          marginBottom: idx < roles.length - 1 ? '10px' : '0',
          boxSizing: 'border-box',
          outline: 'none',
        });
        btn.type = 'button';

        /* Icon badge */
        var iconBadge = el('span', {
          flexShrink: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          background: '#0c2a4a',
          borderRadius: '8px',
          color: '#60a5fa',
        });
        iconBadge.innerHTML = role.type === 'initiator' ? svgPen() : svgCheck();
        btn.appendChild(iconBadge);

        /* Text block */
        var textBlock = el('span', { flex: '1', minWidth: '0' });

        var labelEl = el('span', {
          display: 'block',
          fontWeight: '600',
          fontSize: '15px',
          color: '#f1f5f9',
          marginBottom: '3px',
          lineHeight: '1.3',
        });
        labelEl.textContent = role.label || role.type;
        textBlock.appendChild(labelEl);

        var sublabelEl = el('span', {
          display: 'block',
          fontSize: '13px',
          color: '#94a3b8',
          lineHeight: '1.3',
        });
        sublabelEl.textContent = role.sublabel || role.companyName || '';
        textBlock.appendChild(sublabelEl);

        btn.appendChild(textBlock);

        /* Arrow */
        var arrow = el('span', { flexShrink: '0', color: '#475569', fontSize: '20px', lineHeight: '1' });
        arrow.textContent = '›';
        btn.appendChild(arrow);

        /* Hover */
        btn.addEventListener('mouseover', function () {
          if (!btn.disabled) {
            btn.style.background = '#1a3352';
            btn.style.borderColor = '#3b82f6';
          }
        });
        btn.addEventListener('mouseout', function () {
          if (!btn.disabled && !btn._selected) {
            btn.style.background = '#1e293b';
            btn.style.borderColor = '#334155';
          }
        });

        btn.addEventListener('click', function () {
          // Lock all buttons
          buttons.forEach(function (b) {
            b.disabled = true;
            b.style.opacity = '0.4';
            b.style.cursor = 'default';
          });
          btn._selected = true;
          btn.style.opacity = '1';
          btn.style.background = '#1a3352';
          btn.style.borderColor = '#3b82f6';

          // Show spinner inside the selected button's arrow
          arrow.innerHTML = svgSpinner();

          _fetch('/api/auth/select-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingTokenId: data.pendingTokenId, roleIndex: idx }),
          })
          .then(function (r) {
            return r.json().then(function (body) {
              if (!r.ok) throw new Error(body.error || 'Role selection failed');
              return body;
            });
          })
          .then(function (result) {
            document.body.removeChild(overlay);
            resolve(new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }));
          })
          .catch(function (err) {
            document.body.removeChild(overlay);
            reject(err);
          });
        });

        buttons.push(btn);
        dialog.appendChild(btn);
      });

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

  /* ── Tiny helper to create a div with inline styles ─────────────────────── */
  function el(tag, styles) {
    var node = document.createElement(tag);
    Object.keys(styles).forEach(function (k) {
      node.style[k] = styles[k];
    });
    return node;
  }

  /* ── SVG icons ───────────────────────────────────────────────────────────── */
  function svgUser() {
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M6 20v-1a6 6 0 0 1 12 0v1"/>' +
      '</svg>';
  }

  function svgPen() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>' +
      '</svg>';
  }

  function svgCheck() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="20 6 9 17 4 12"/>' +
      '</svg>';
  }

  function svgSpinner() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
      '<style>@keyframes __rp_spin{to{transform:rotate(360deg)}}</style>' +
      '<g style="transform-origin:center;animation:__rp_spin 0.8s linear infinite">' +
      '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83' +
      'M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>' +
      '</g></svg>';
  }
})();
