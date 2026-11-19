/* 27-zwui：对外暴露的测试接口，apply() 里调用。
 * window.ZWUi 是纯函数（ZWUI）；window.ZWStore（存储、会话态、任务表）在 26-store 写好后加在这里；
 * window.ZWReport 由 30-report 提供。 */
function exposeTestApis() {
  try {
    if (typeof window !== 'undefined') {
      window.ZWUi = ZWUI;
    }
  } catch (e) { /* 非浏览器环境忽略 */ }
}
