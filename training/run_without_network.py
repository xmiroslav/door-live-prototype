#!/usr/bin/env python3
"""Run a local verification command with new IP sockets/outbound sends denied.

Linux/libseccomp only; no privilege escalation. Filter is inherited across exec.
The child is never started if the filter cannot be installed.
"""
import argparse
import ctypes
import ctypes.util
import errno
import os
import socket


class ArgumentComparison(ctypes.Structure):
    _fields_ = [('arg', ctypes.c_uint), ('op', ctypes.c_int),
                ('datum_a', ctypes.c_uint64), ('datum_b', ctypes.c_uint64)]


def install_network_filter():
    library = ctypes.util.find_library('seccomp')
    if not library:
        raise RuntimeError('libseccomp unavailable; refusing to run without isolation')
    api = ctypes.CDLL(library, use_errno=True)
    api.seccomp_init.argtypes = [ctypes.c_uint32]
    api.seccomp_init.restype = ctypes.c_void_p
    api.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    api.seccomp_syscall_resolve_name.restype = ctypes.c_int
    api.seccomp_rule_add_array.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int,
                                         ctypes.c_uint, ctypes.POINTER(ArgumentComparison)]
    api.seccomp_rule_add_array.restype = ctypes.c_int
    api.seccomp_load.argtypes = [ctypes.c_void_p]
    api.seccomp_load.restype = ctypes.c_int
    api.seccomp_release.argtypes = [ctypes.c_void_p]
    context = api.seccomp_init(0x7fff0000)  # SCMP_ACT_ALLOW
    if not context:
        raise RuntimeError('Cannot initialize local network isolation')
    deny = 0x00050000 | errno.ENETUNREACH  # SCMP_ACT_ERRNO
    try:
        socket_call = api.seccomp_syscall_resolve_name(b'socket')
        for family in (socket.AF_INET, socket.AF_INET6):
            comparison = ArgumentComparison(0, 4, family, 0)  # SCMP_CMP_EQ
            if api.seccomp_rule_add_array(context, deny, socket_call, 1, ctypes.byref(comparison)) != 0:
                raise RuntimeError('Cannot deny IP sockets')
        for name in (b'connect', b'sendto', b'sendmsg', b'sendmmsg'):
            number = api.seccomp_syscall_resolve_name(name)
            if number >= 0 and api.seccomp_rule_add_array(context, deny, number, 0, None) != 0:
                raise RuntimeError('Cannot deny outbound network operations')
        if api.seccomp_load(context) != 0:
            raise RuntimeError('Cannot install network isolation; child was not started')
    finally:
        api.seccomp_release(context)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('Supply an executable and arguments')
    install_network_filter()
    environment = dict(os.environ, ORT_DISABLE_TELEMETRY='1', DOORLIVE_NETWORK_ISOLATED='1')
    os.execvpe(command[0], command, environment)
