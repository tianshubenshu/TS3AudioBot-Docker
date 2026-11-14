# TS3AudioBot-Docker 中文使用说明

本项目在 Docker 中运行 TeamSpeak 3 音乐机器人，并提供可选的网页控制面板。面板支持简体中文、英语和德语：默认跟随浏览器语言，也可以在页面右上方的语言菜单选择“简体中文”。机器人本体的命令和上游返回的信息不一定有中文。

## 组成

- 机器人容器负责连接 TeamSpeak、获取音频并发送到频道。
- 网页面板负责账户、机器人控制和电台管理；面板数据存储在 MariaDB 中。
- 机器人连接设置及身份文件存放在 Docker 数据卷 `ts3audiobot-data` 中。

只需要机器人时可使用 `docker-compose.yml`；需要网页面板时使用 `docker-compose.panel.yml`，它同时启动机器人、面板和 MariaDB。已有 MariaDB 的用户可参考 `docker-compose.panel-external-db.yml`。完整配置和安全说明请参阅 [英文 README](README.md)。

## 首次部署面板

1. 克隆本仓库，进入仓库目录，并复制环境配置：`cp panel/.env.example .env`。
2. 编辑 `.env`，设置 `PANEL_ADMIN_PASSWORD`、`PANEL_DB_PASSWORD`、`PANEL_DB_ROOT_PASSWORD` 和随机的 `PANEL_TOKEN_KEY`。
3. 使用 `docker compose -f docker-compose.panel.yml -f docker-compose.zh.yml up -d --build` 构建并启动中文版面板。已有外部数据库时，将第一个文件换成 `docker-compose.panel-external-db.yml`。
4. 打开 `http://服务器地址:8080`，使用 `admin` 和设置的面板密码登录。
5. 在“概览”添加实例，API 地址填 `http://ts3audiobot:58913`。添加或关联机器人，在“连接”填写 TeamSpeak 服务器地址并启动。

如需使用聊天中的电台命令，在 `.env` 设置独立的 `PANEL_RADIO_SECRET`，例如运行 `openssl rand -hex 32` 生成并填入结果；不要与其他密钥共用。然后重新运行第 3 步，让面板和机器人使用同一密钥。密钥为空或不足 32 字节时，电台查询会关闭。

## 添加电台

打开机器人页面，进入“电台”，填写电台名称和 HTTP/HTTPS 音频流地址并保存。可以选择共享，再点击“播放”。链接必须指向机器人能访问的音频流，普通网页地址不一定能播放。

在 TeamSpeak 中给机器人发送 `!列出电台` 可以查看第一页共享电台，`!列出电台 2` 查看第二页；使用 `!播放电台 电台名称` 播放，名称须完全一致。如果有同名共享电台，请先在面板中调整名称。聊天命令只能看到共享电台，私人电台不会被列出或播放。

其他中文命令：`!播放 链接`、`!播放`（继续播放）、`!暂停`、`!停止`、`!下一首`、`!上一首`、`!音量 50`。英文命令仍可用；中文命令沿用相应英文命令的权限。`!播放电台` 沿用播放权限，`!列出电台` 沿用查看当前歌曲权限。修改源码构建的机器人镜像后才有这些命令，更新上游镜像不会自动带上它们。

## 保存和更新

面板数据保存在 MariaDB 数据卷中。更新前参照 [英文 README 的备份步骤](README.md#update)备份数据库；机器人配置位于另一个数据卷。`docker compose down` 会保留数据，`down -v` 会删除数据卷。

默认 Compose 拉取项目配置的远程镜像；上面的附加配置会从本仓库源码构建中文面板。之后启动或更新时请继续指定两个配置文件，并保持 Compose 项目名称不变，以沿用已有数据卷。机器人 API 的 58913 端口默认不对宿主机开放，请保持该设置。
