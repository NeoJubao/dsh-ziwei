/* 27-zwui：对外暴露的测试接口，apply() 里调用。
 * window.ZWUi 是纯函数（ZWUI，20-util 声明，各文件往上挂）；
 * window.ZWReport 是报告模块（ZWREPORT，30-report 声明）；
 * window.ZWStore 是存储、会话态、任务表（ZWSTORE，26-store 声明）。
 * 后两个在各自的任务完成之前不存在，所以用 typeof 判断。 */
function exposeTestApis() {
  try {
    if (typeof window !== 'undefined') {
      window.ZWUi = ZWUI;
      if (typeof ZWREPORT !== 'undefined') window.ZWReport = ZWREPORT;
      if (typeof ZWSTORE !== 'undefined') window.ZWStore = ZWSTORE;
    }
  } catch (e) { /* 非浏览器环境忽略 */ }
}
