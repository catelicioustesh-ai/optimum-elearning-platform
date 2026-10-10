"""Loopback development relay to the network-isolated code runner."""

import asyncio
import logging


LOGGER = logging.getLogger("runner_proxy")
RUNNER_HOST = "sandbox"
RUNNER_PORT = 9000
PROXY_HOST = "0.0.0.0"
PROXY_PORT = 9001


async def _close_writer(writer):
    writer.close()
    try:
        await writer.wait_closed()
    except OSError as error:
        LOGGER.debug("Connection closed while shutting down the relay: %s", error)


async def _pipe(reader, writer):
    try:
        while chunk := await reader.read(65536):
            writer.write(chunk)
            await writer.drain()
    except OSError as error:
        LOGGER.debug("Connection closed while relaying data: %s", error)
    finally:
        await _close_writer(writer)


async def _handle_connection(client_reader, client_writer):
    runner_writer = None
    try:
        runner_reader, runner_writer = await asyncio.wait_for(
            asyncio.open_connection(RUNNER_HOST, RUNNER_PORT),
            timeout=5,
        )
        await asyncio.gather(
            _pipe(client_reader, runner_writer),
            _pipe(runner_reader, client_writer),
        )
    except (OSError, asyncio.TimeoutError) as error:
        LOGGER.warning("Could not relay request to the code runner: %s", error)
    finally:
        if runner_writer is not None:
            await _close_writer(runner_writer)
        await _close_writer(client_writer)


async def main():
    server = await asyncio.start_server(_handle_connection, PROXY_HOST, PROXY_PORT)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
