/* 22-stream：SSE 客户端（T3b）
 *
 * openInterpretStream({ fetch, body, onStart, onRetry, onThinking, onDelta, onDone, onFinish }) → { abort(userRequested) }
 *   POST /ziwei/interpret（JSON 正文 body），按 SSE 读回复。线协议和结束语义照搬 v5 的 openStream：
 *   - 块之间用空行分隔，可能被拆在几次 read 里；块内 `event: ` 是事件名，`data: ` 行拼成 JSON。
 *     不认识的事件、解析不了的 JSON 跳过。
 *   - start { provider, model, … } → onStart(payload)；retry → onRetry(payload)（Host 在同一个请求里再问一次，见 index.js）；
 *     thinking { chars } → onThinking(chars)；delta { text } → onDelta(text)；
 *     done { text } → onDone(text，没有就用已收到的全文)，然后正常结束；error { reason, kind, canContinue } → 带着它结束。
 *   - 只有收到 done 才算写完。流关了还没有 done → 断连原因 + { kind: 'stream-closed', canContinue }。
 *   - 非 2xx → 原因取 JSON 正文的 reason，没有就是 "HTTP <status>"（issue 为 null，和 v5 一样）。
 *   - abort(true) 是用户停止：马上结束，{ kind: 'stopped', canContinue }；abort(false) 是静默中止（插件卸载），
 *     原因为空，{ kind: 'aborted', canContinue }。之后到达的事件一律丢弃。
 *   - onFinish(error, issue, produced) 恰好调用一次；error 为空串表示写完了。canContinue = 已收到的正文不是空白。
 * fetch 由调用方注入（store 用 deps.fetch，自检用假的）；有 AbortController 就用它中止请求，没有也能停（读循环自己退出）。 */
function openInterpretStream(opts) {
  const o = opts || {};
  const call = function (name, arg) {
    if (typeof o[name] === 'function') o[name](arg);
  };
  let controller = null;
  try { controller = typeof AbortController === 'function' ? new AbortController() : null; } catch (e) { controller = null; }
  let settled = false;
  let gotDone = false;
  let produced = '';
  let reader = null;
  const canContinue = function () { return !!produced.trim(); };
  const finish = function (err, issue) {
    if (settled) return;
    settled = true;
    if (typeof o.onFinish === 'function') o.onFinish(err || '', issue || null, produced);
  };

  const handleBlock = function (block) {
    let ev = 'message', data = '';
    block.split('\n').forEach(function (line) {
      if (line.indexOf('event: ') === 0) ev = line.slice(7).trim();
      else if (line.indexOf('data: ') === 0) data += line.slice(6);
    });
    if (!data) return;
    let payload = null;
    try { payload = JSON.parse(data); } catch (e) { return; }
    if (ev === 'start') {
      call('onStart', payload);
    } else if (ev === 'retry') {
      /* Host 发现模型没有作答、正在同一个请求里再问一次 */
      call('onRetry', payload);
    } else if (ev === 'thinking') {
      call('onThinking', (payload && payload.chars) || 0);
    } else if (ev === 'delta' && payload && payload.text) {
      produced += payload.text;
      call('onDelta', payload.text);
    } else if (ev === 'done') {
      gotDone = true;
      call('onDone', (payload && typeof payload.text === 'string') ? payload.text : produced);
      finish('');
    } else if (ev === 'error') {
      finish((payload && payload.reason) || t('aiFailed'), payload);
    }
  };

  let started;
  try {
    started = Promise.resolve(o.fetch('/ziwei/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(o.body || {}),
      signal: controller ? controller.signal : undefined
    }));
  } catch (e) {
    started = Promise.reject(e);
  }
  started.then(function (resp) {
    if (settled) return undefined;
    if (!resp.ok) {
      return resp.text().then(function (txt) {
        let reason = 'HTTP ' + resp.status;
        try { const j = JSON.parse(txt); if (j && j.reason) reason = String(j.reason); } catch (e) { /* 不是 JSON */ }
        finish(reason);
      }, function () { finish('HTTP ' + resp.status); });
    }
    if (!resp.body || typeof resp.body.getReader !== 'function') {
      finish(t('aiNoStream'));
      return undefined;
    }
    reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const pump = function () {
      if (settled) return undefined;
      return reader.read().then(function (chunk) {
        if (settled) return undefined;
        if (chunk.done) {
          if (!gotDone) {
            finish(canContinue() ? t('aiDisconnected') : t('aiDisconnectedEmpty'), { kind: 'stream-closed', canContinue: canContinue() });
          }
          return undefined;
        }
        buf = (buf + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (let i = 0; i < parts.length && !settled; i++) handleBlock(parts[i]);
        return pump();
      });
    };
    return pump();
  }).catch(function (e) {
    if (e && e.name === 'AbortError') { finish('', { kind: 'aborted', canContinue: canContinue() }); return; }
    finish(String((e && e.message) || e), { kind: 'error', canContinue: canContinue() });
  });

  return {
    abort: function (userRequested) {
      if (settled) return;
      if (userRequested) finish(canContinue() ? t('aiStopped') : t('aiStoppedEmpty'), { kind: 'stopped', canContinue: canContinue() });
      else finish('', { kind: 'aborted', canContinue: canContinue() });
      try { if (controller) controller.abort(); } catch (e) { /* ignore */ }
      try { if (reader && typeof reader.cancel === 'function') reader.cancel().catch(function () {}); } catch (e) { /* ignore */ }
    }
  };
}
