"""Constellation themes for Textual — generated from constellation.tokens.json by build_tokens.py. Do not edit.

    from constellation_theme import ConstellationApp, glyph, style

    class Constellation(ConstellationApp):   # registers themes, picks dark/light, 256 or 16 colors
        ...

Color depth: CONSTELLATION_COLOR=truecolor|256|16 overrides detection (app.console.color_system).
Glyph tier: CONSTELLATION_GLYPHS=unicode|ascii|nerd overrides detection (UTF-8 locale -> unicode).
"""
from __future__ import annotations

import locale
import os

from textual.app import App
from textual.theme import Theme

THEMES: dict[str, Theme] = {
    'constellation-dark': Theme(
        name='constellation-dark',
        primary='#b3c1ff',
        secondary='#45c4c4',
        accent='#45c4c4',
        warning='#f5a524',
        error='#ff6b45',
        success='#4cc790',
        foreground='#e3e7ee',
        background='#0a0c10',
        surface='#0f1218',
        panel='#141821',
        dark=True,
        variables={
            'bg': '#0a0c10',
            'bg-style': 'none',
            'surface': '#0f1218',
            'surface-style': 'none',
            'panel': '#141821',
            'panel-style': 'none',
            'raised': '#1a1f2a',
            'raised-style': 'none',
            'hover': '#1e2431',
            'hover-style': 'none',
            'selection': '#26304f',
            'selection-style': 'none',
            'fg': '#e3e7ee',
            'fg-style': 'none',
            'fg-strong': '#f6f8fc',
            'fg-strong-style': 'none',
            'fg-muted': '#97a0b2',
            'fg-muted-style': 'none',
            'fg-faint': '#687186',
            'fg-faint-style': 'none',
            'line': '#252b38',
            'line-style': 'none',
            'line-strong': '#343c4d',
            'line-strong-style': 'none',
            'line-control': '#666f85',
            'line-control-style': 'none',
            'focus': '#b3c1ff',
            'focus-style': 'none',
            'brand': '#b3c1ff',
            'brand-style': 'none',
            'fill-brand': '#b3c1ff',
            'fill-brand-style': 'none',
            'on-fill-brand': '#0a0c10',
            'on-fill-brand-style': 'none',
            'status-working': '#5cb4f0',
            'status-working-style': 'none',
            'status-waiting': '#f5a524',
            'status-waiting-style': 'none',
            'status-waiting-fill': '#f5a524',
            'status-waiting-fill-style': 'none',
            'on-status-waiting-fill': '#15100a',
            'on-status-waiting-fill-style': 'none',
            'status-idle': '#97a0b2',
            'status-idle-style': 'none',
            'status-stale': '#ec8cc4',
            'status-stale-style': 'none',
            'status-error': '#ff6b45',
            'status-error-style': 'none',
            'status-stopped': '#97a0b2',
            'status-stopped-style': 'none',
            'mode-default': '#97a0b2',
            'mode-default-style': 'none',
            'mode-plan': '#4cc790',
            'mode-plan-style': 'none',
            'mode-edits': '#b994ff',
            'mode-edits-style': 'none',
            'mode-auto': '#b994ff',
            'mode-auto-style': 'none',
            'on-mode-auto': '#0a0c10',
            'on-mode-auto-style': 'none',
            'mode-bypass': '#ff6b45',
            'mode-bypass-style': 'none',
            'on-mode-bypass': '#0a0c10',
            'on-mode-bypass-style': 'none',
            'mode-dontask': '#8e9ab4',
            'mode-dontask-style': 'none',
            'msg-prompt': '#b3c1ff',
            'msg-prompt-style': 'none',
            'msg-slash': '#b3c1ff',
            'msg-slash-style': 'none',
            'msg-tool': '#5cb4f0',
            'msg-tool-style': 'none',
            'msg-question': '#f5a524',
            'msg-question-style': 'none',
            'msg-answer': '#4cc790',
            'msg-answer-style': 'none',
            'msg-denied': '#ff6b45',
            'msg-denied-style': 'none',
            'msg-sent': '#45c4c4',
            'msg-sent-style': 'none',
            'msg-received': '#45c4c4',
            'msg-received-style': 'none',
            'msg-subagent': '#45c4c4',
            'msg-subagent-style': 'none',
            'msg-reply': '#e3e7ee',
            'msg-reply-style': 'none',
            'res-normal': '#7f97cc',
            'res-normal-style': 'none',
            'res-warning': '#f5a524',
            'res-warning-style': 'none',
            'res-critical': '#ff6b45',
            'res-critical-style': 'none',
            'res-critical-fill': '#ff6b45',
            'res-critical-fill-style': 'none',
            'on-res-critical-fill': '#0a0c10',
            'on-res-critical-fill-style': 'none',
            'res-track': '#343c4d',
            'res-track-style': 'none',
            'kind-managed': '#b3c1ff',
            'kind-managed-style': 'none',
            'kind-external': '#8e9ab4',
            'kind-external-style': 'none',
            'edge': '#45c4c4',
            'edge-style': 'none',
            'edge-subagent': '#8e9ab4',
            'edge-subagent-style': 'none',
            'block-cursor-background': '#26304f',
            'block-cursor-foreground': '#f6f8fc',
            'block-cursor-blurred-background': '#141821',
            'block-cursor-blurred-foreground': '#e3e7ee',
            'border': '#b3c1ff',
            'border-blurred': '#252b38',
            'footer-background': '#141821',
            'footer-foreground': '#97a0b2',
            'footer-key-foreground': '#b3c1ff',
            'footer-description-foreground': '#97a0b2',
            'input-selection-background': '#26304f',
            'input-cursor-background': '#b3c1ff',
            'input-cursor-foreground': '#0a0c10',
            'scrollbar': '#343c4d',
            'scrollbar-hover': '#666f85',
            'scrollbar-active': '#b3c1ff',
            'scrollbar-background': '#141821',
            'scrollbar-background-hover': '#141821',
            'scrollbar-background-active': '#141821',
            'scrollbar-corner-color': '#141821',
            'link-color': '#e3e7ee',
            'link-color-hover': '#f6f8fc',
            'link-background-hover': '#26304f',
            'screen-selection-background': '#26304f',
            'screen-selection-foreground': '#f6f8fc',
            'text-muted': '#97a0b2',
            'text-disabled': '#687186',
            'block-cursor-text-style': 'bold',
            'block-cursor-blurred-text-style': 'none',
            'input-cursor-text-style': 'none',
            'link-style': 'underline',
            'link-style-hover': 'underline',
            'button-focus-text-style': 'bold',
        },
    ),
    'constellation-dark-256': Theme(
        name='constellation-dark-256',
        primary='#afafff',
        secondary='#5fd7d7',
        accent='#5fd7d7',
        warning='#ffaf00',
        error='#ff875f',
        success='#00d787',
        foreground='#ebebeb',
        background='#141414',
        surface='#1f1f1f',
        panel='#292929',
        dark=True,
        variables={
            'bg': '#141414',
            'bg-style': 'none',
            'surface': '#1f1f1f',
            'surface-style': 'none',
            'panel': '#292929',
            'panel-style': 'none',
            'raised': '#333333',
            'raised-style': 'none',
            'hover': '#292929',
            'hover-style': 'none',
            'selection': '#3d3d3d',
            'selection-style': 'none',
            'fg': '#ebebeb',
            'fg-style': 'none',
            'fg-strong': '#ffffff',
            'fg-strong-style': 'none',
            'fg-muted': '#adadad',
            'fg-muted-style': 'none',
            'fg-faint': '#858585',
            'fg-faint-style': 'none',
            'line': '#292929',
            'line-style': 'none',
            'line-strong': '#3d3d3d',
            'line-strong-style': 'none',
            'line-control': '#858585',
            'line-control-style': 'none',
            'focus': '#afafff',
            'focus-style': 'none',
            'brand': '#afafff',
            'brand-style': 'none',
            'fill-brand': '#afafff',
            'fill-brand-style': 'none',
            'on-fill-brand': '#0a0a0a',
            'on-fill-brand-style': 'none',
            'status-working': '#00afff',
            'status-working-style': 'none',
            'status-waiting': '#ffaf00',
            'status-waiting-style': 'none',
            'status-waiting-fill': '#ffaf00',
            'status-waiting-fill-style': 'none',
            'on-status-waiting-fill': '#141414',
            'on-status-waiting-fill-style': 'none',
            'status-idle': '#adadad',
            'status-idle-style': 'none',
            'status-stale': '#ff87d7',
            'status-stale-style': 'none',
            'status-error': '#ff875f',
            'status-error-style': 'none',
            'status-stopped': '#adadad',
            'status-stopped-style': 'none',
            'mode-default': '#adadad',
            'mode-default-style': 'none',
            'mode-plan': '#00d787',
            'mode-plan-style': 'none',
            'mode-edits': '#d787ff',
            'mode-edits-style': 'none',
            'mode-auto': '#af87ff',
            'mode-auto-style': 'none',
            'on-mode-auto': '#0a0a0a',
            'on-mode-auto-style': 'none',
            'mode-bypass': '#ff875f',
            'mode-bypass-style': 'none',
            'on-mode-bypass': '#0a0a0a',
            'on-mode-bypass-style': 'none',
            'mode-dontask': '#87afd7',
            'mode-dontask-style': 'none',
            'msg-prompt': '#afafff',
            'msg-prompt-style': 'none',
            'msg-slash': '#afafff',
            'msg-slash-style': 'none',
            'msg-tool': '#00afff',
            'msg-tool-style': 'none',
            'msg-question': '#ffaf00',
            'msg-question-style': 'none',
            'msg-answer': '#00d787',
            'msg-answer-style': 'none',
            'msg-denied': '#ff875f',
            'msg-denied-style': 'none',
            'msg-sent': '#5fd7d7',
            'msg-sent-style': 'none',
            'msg-received': '#5fd7d7',
            'msg-received-style': 'none',
            'msg-subagent': '#5fd7d7',
            'msg-subagent-style': 'none',
            'msg-reply': '#ebebeb',
            'msg-reply-style': 'none',
            'res-normal': '#8787d7',
            'res-normal-style': 'none',
            'res-warning': '#ffaf00',
            'res-warning-style': 'none',
            'res-critical': '#ff875f',
            'res-critical-style': 'none',
            'res-critical-fill': '#ff875f',
            'res-critical-fill-style': 'none',
            'on-res-critical-fill': '#0a0a0a',
            'on-res-critical-fill-style': 'none',
            'res-track': '#3d3d3d',
            'res-track-style': 'none',
            'kind-managed': '#afafff',
            'kind-managed-style': 'none',
            'kind-external': '#87afd7',
            'kind-external-style': 'none',
            'edge': '#5fd7d7',
            'edge-style': 'none',
            'edge-subagent': '#8787af',
            'edge-subagent-style': 'none',
            'block-cursor-background': '#3d3d3d',
            'block-cursor-foreground': '#ffffff',
            'block-cursor-blurred-background': '#292929',
            'block-cursor-blurred-foreground': '#ebebeb',
            'border': '#afafff',
            'border-blurred': '#292929',
            'footer-background': '#292929',
            'footer-foreground': '#adadad',
            'footer-key-foreground': '#afafff',
            'footer-description-foreground': '#adadad',
            'input-selection-background': '#3d3d3d',
            'input-cursor-background': '#afafff',
            'input-cursor-foreground': '#141414',
            'scrollbar': '#3d3d3d',
            'scrollbar-hover': '#858585',
            'scrollbar-active': '#afafff',
            'scrollbar-background': '#292929',
            'scrollbar-background-hover': '#292929',
            'scrollbar-background-active': '#292929',
            'scrollbar-corner-color': '#292929',
            'link-color': '#ebebeb',
            'link-color-hover': '#ffffff',
            'link-background-hover': '#3d3d3d',
            'screen-selection-background': '#3d3d3d',
            'screen-selection-foreground': '#ffffff',
            'text-muted': '#adadad',
            'text-disabled': '#858585',
            'block-cursor-text-style': 'bold',
            'block-cursor-blurred-text-style': 'none',
            'input-cursor-text-style': 'none',
            'link-style': 'underline',
            'link-style-hover': 'underline',
            'button-focus-text-style': 'bold',
        },
    ),
    'constellation-light': Theme(
        name='constellation-light',
        primary='#3646b3',
        secondary='#0a6c75',
        accent='#0a6c75',
        warning='#855300',
        error='#b42d0c',
        success='#146e45',
        foreground='#1a1e28',
        background='#f6f7fa',
        surface='#ffffff',
        panel='#eef0f5',
        dark=False,
        variables={
            'bg': '#f6f7fa',
            'bg-style': 'none',
            'surface': '#ffffff',
            'surface-style': 'none',
            'panel': '#eef0f5',
            'panel-style': 'none',
            'raised': '#ffffff',
            'raised-style': 'none',
            'hover': '#e7eaf1',
            'hover-style': 'none',
            'selection': '#e3e8fb',
            'selection-style': 'none',
            'fg': '#1a1e28',
            'fg-style': 'none',
            'fg-strong': '#07090d',
            'fg-strong-style': 'none',
            'fg-muted': '#566074',
            'fg-muted-style': 'none',
            'fg-faint': '#7c8496',
            'fg-faint-style': 'none',
            'line': '#dfe2e9',
            'line-style': 'none',
            'line-strong': '#c9ced8',
            'line-strong-style': 'none',
            'line-control': '#7a8396',
            'line-control-style': 'none',
            'focus': '#3646b3',
            'focus-style': 'none',
            'brand': '#3646b3',
            'brand-style': 'none',
            'fill-brand': '#3949b8',
            'fill-brand-style': 'none',
            'on-fill-brand': '#ffffff',
            'on-fill-brand-style': 'none',
            'status-working': '#0b67a6',
            'status-working-style': 'none',
            'status-waiting': '#855300',
            'status-waiting-style': 'none',
            'status-waiting-fill': '#f2a228',
            'status-waiting-fill-style': 'none',
            'on-status-waiting-fill': '#15100a',
            'on-status-waiting-fill-style': 'none',
            'status-idle': '#566074',
            'status-idle-style': 'none',
            'status-stale': '#a8306f',
            'status-stale-style': 'none',
            'status-error': '#b42d0c',
            'status-error-style': 'none',
            'status-stopped': '#566074',
            'status-stopped-style': 'none',
            'mode-default': '#566074',
            'mode-default-style': 'none',
            'mode-plan': '#146e45',
            'mode-plan-style': 'none',
            'mode-edits': '#6b3fd0',
            'mode-edits-style': 'none',
            'mode-auto': '#6b3fd0',
            'mode-auto-style': 'none',
            'on-mode-auto': '#ffffff',
            'on-mode-auto-style': 'none',
            'mode-bypass': '#c4320c',
            'mode-bypass-style': 'none',
            'on-mode-bypass': '#ffffff',
            'on-mode-bypass-style': 'none',
            'mode-dontask': '#545f77',
            'mode-dontask-style': 'none',
            'msg-prompt': '#3646b3',
            'msg-prompt-style': 'none',
            'msg-slash': '#3646b3',
            'msg-slash-style': 'none',
            'msg-tool': '#0b67a6',
            'msg-tool-style': 'none',
            'msg-question': '#855300',
            'msg-question-style': 'none',
            'msg-answer': '#146e45',
            'msg-answer-style': 'none',
            'msg-denied': '#b42d0c',
            'msg-denied-style': 'none',
            'msg-sent': '#0a6c75',
            'msg-sent-style': 'none',
            'msg-received': '#0a6c75',
            'msg-received-style': 'none',
            'msg-subagent': '#0a6c75',
            'msg-subagent-style': 'none',
            'msg-reply': '#1a1e28',
            'msg-reply-style': 'none',
            'res-normal': '#4a6293',
            'res-normal-style': 'none',
            'res-warning': '#855300',
            'res-warning-style': 'none',
            'res-critical': '#b42d0c',
            'res-critical-style': 'none',
            'res-critical-fill': '#c4320c',
            'res-critical-fill-style': 'none',
            'on-res-critical-fill': '#ffffff',
            'on-res-critical-fill-style': 'none',
            'res-track': '#c9ced8',
            'res-track-style': 'none',
            'kind-managed': '#3646b3',
            'kind-managed-style': 'none',
            'kind-external': '#545f77',
            'kind-external-style': 'none',
            'edge': '#0a6c75',
            'edge-style': 'none',
            'edge-subagent': '#545f77',
            'edge-subagent-style': 'none',
            'block-cursor-background': '#e3e8fb',
            'block-cursor-foreground': '#07090d',
            'block-cursor-blurred-background': '#eef0f5',
            'block-cursor-blurred-foreground': '#1a1e28',
            'border': '#3646b3',
            'border-blurred': '#dfe2e9',
            'footer-background': '#eef0f5',
            'footer-foreground': '#566074',
            'footer-key-foreground': '#3646b3',
            'footer-description-foreground': '#566074',
            'input-selection-background': '#e3e8fb',
            'input-cursor-background': '#3646b3',
            'input-cursor-foreground': '#f6f7fa',
            'scrollbar': '#c9ced8',
            'scrollbar-hover': '#7a8396',
            'scrollbar-active': '#3646b3',
            'scrollbar-background': '#eef0f5',
            'scrollbar-background-hover': '#eef0f5',
            'scrollbar-background-active': '#eef0f5',
            'scrollbar-corner-color': '#eef0f5',
            'link-color': '#1a1e28',
            'link-color-hover': '#07090d',
            'link-background-hover': '#e3e8fb',
            'screen-selection-background': '#e3e8fb',
            'screen-selection-foreground': '#07090d',
            'text-muted': '#566074',
            'text-disabled': '#7c8496',
            'block-cursor-text-style': 'bold',
            'block-cursor-blurred-text-style': 'none',
            'input-cursor-text-style': 'none',
            'link-style': 'underline',
            'link-style-hover': 'underline',
            'button-focus-text-style': 'bold',
        },
    ),
    'constellation-light-256': Theme(
        name='constellation-light-256',
        primary='#5f5faf',
        secondary='#005f5f',
        accent='#005f5f',
        warning='#875f00',
        error='#af0000',
        success='#005f00',
        foreground='#1f1f1f',
        background='#f5f5f5',
        surface='#ffffff',
        panel='#ebebeb',
        dark=False,
        variables={
            'bg': '#f5f5f5',
            'bg-style': 'none',
            'surface': '#ffffff',
            'surface-style': 'none',
            'panel': '#ebebeb',
            'panel-style': 'none',
            'raised': '#ffffff',
            'raised-style': 'none',
            'hover': '#f5f5f5',
            'hover-style': 'none',
            'selection': '#d7ffff',
            'selection-style': 'none',
            'fg': '#1f1f1f',
            'fg-style': 'none',
            'fg-strong': '#0a0a0a',
            'fg-strong-style': 'none',
            'fg-muted': '#5f5f87',
            'fg-muted-style': 'none',
            'fg-faint': '#858585',
            'fg-faint-style': 'none',
            'line': '#ebebeb',
            'line-style': 'none',
            'line-strong': '#d6d6d6',
            'line-strong-style': 'none',
            'line-control': '#858585',
            'line-control-style': 'none',
            'focus': '#5f5faf',
            'focus-style': 'none',
            'brand': '#005fd7',
            'brand-style': 'none',
            'fill-brand': '#5f5faf',
            'fill-brand-style': 'none',
            'on-fill-brand': '#ffffff',
            'on-fill-brand-style': 'none',
            'status-working': '#005faf',
            'status-working-style': 'none',
            'status-waiting': '#875f00',
            'status-waiting-style': 'none',
            'status-waiting-fill': '#ffaf00',
            'status-waiting-fill-style': 'none',
            'on-status-waiting-fill': '#141414',
            'on-status-waiting-fill-style': 'none',
            'status-idle': '#5f5f87',
            'status-idle-style': 'none',
            'status-stale': '#af005f',
            'status-stale-style': 'none',
            'status-error': '#af0000',
            'status-error-style': 'none',
            'status-stopped': '#5f5f87',
            'status-stopped-style': 'none',
            'mode-default': '#5f5f87',
            'mode-default-style': 'none',
            'mode-plan': '#005f00',
            'mode-plan-style': 'none',
            'mode-edits': '#8700d7',
            'mode-edits-style': 'none',
            'mode-auto': '#8700d7',
            'mode-auto-style': 'none',
            'on-mode-auto': '#ffffff',
            'on-mode-auto-style': 'none',
            'mode-bypass': '#d70000',
            'mode-bypass-style': 'none',
            'on-mode-bypass': '#ffffff',
            'on-mode-bypass-style': 'none',
            'mode-dontask': '#666666',
            'mode-dontask-style': 'none',
            'msg-prompt': '#005fd7',
            'msg-prompt-style': 'none',
            'msg-slash': '#005fd7',
            'msg-slash-style': 'none',
            'msg-tool': '#005faf',
            'msg-tool-style': 'none',
            'msg-question': '#875f00',
            'msg-question-style': 'none',
            'msg-answer': '#005f00',
            'msg-answer-style': 'none',
            'msg-denied': '#af0000',
            'msg-denied-style': 'none',
            'msg-sent': '#005f5f',
            'msg-sent-style': 'none',
            'msg-received': '#005f5f',
            'msg-received-style': 'none',
            'msg-subagent': '#005f5f',
            'msg-subagent-style': 'none',
            'msg-reply': '#1f1f1f',
            'msg-reply-style': 'none',
            'res-normal': '#5f5faf',
            'res-normal-style': 'none',
            'res-warning': '#875f00',
            'res-warning-style': 'none',
            'res-critical': '#af0000',
            'res-critical-style': 'none',
            'res-critical-fill': '#d70000',
            'res-critical-fill-style': 'none',
            'on-res-critical-fill': '#ffffff',
            'on-res-critical-fill-style': 'none',
            'res-track': '#d6d6d6',
            'res-track-style': 'none',
            'kind-managed': '#5f5faf',
            'kind-managed-style': 'none',
            'kind-external': '#5f5f87',
            'kind-external-style': 'none',
            'edge': '#005f5f',
            'edge-style': 'none',
            'edge-subagent': '#5f5f87',
            'edge-subagent-style': 'none',
            'block-cursor-background': '#d7ffff',
            'block-cursor-foreground': '#0a0a0a',
            'block-cursor-blurred-background': '#ebebeb',
            'block-cursor-blurred-foreground': '#1f1f1f',
            'border': '#5f5faf',
            'border-blurred': '#ebebeb',
            'footer-background': '#ebebeb',
            'footer-foreground': '#5f5f87',
            'footer-key-foreground': '#5f5faf',
            'footer-description-foreground': '#5f5f87',
            'input-selection-background': '#d7ffff',
            'input-cursor-background': '#5f5faf',
            'input-cursor-foreground': '#f5f5f5',
            'scrollbar': '#d6d6d6',
            'scrollbar-hover': '#858585',
            'scrollbar-active': '#5f5faf',
            'scrollbar-background': '#ebebeb',
            'scrollbar-background-hover': '#ebebeb',
            'scrollbar-background-active': '#ebebeb',
            'scrollbar-corner-color': '#ebebeb',
            'link-color': '#1f1f1f',
            'link-color-hover': '#0a0a0a',
            'link-background-hover': '#d7ffff',
            'screen-selection-background': '#d7ffff',
            'screen-selection-foreground': '#0a0a0a',
            'text-muted': '#5f5f87',
            'text-disabled': '#858585',
            'block-cursor-text-style': 'bold',
            'block-cursor-blurred-text-style': 'none',
            'input-cursor-text-style': 'none',
            'link-style': 'underline',
            'link-style-hover': 'underline',
            'button-focus-text-style': 'bold',
        },
    ),
    'constellation-ansi': Theme(
        name='constellation-ansi',
        primary='ansi_blue',
        secondary='ansi_cyan',
        accent='ansi_cyan',
        warning='ansi_yellow',
        error='ansi_red',
        success='ansi_green',
        foreground='ansi_default',
        background='ansi_default',
        surface='ansi_default',
        panel='ansi_default',
        dark=True,
        ansi=True,
        variables={
            'bg': 'ansi_default',
            'bg-style': 'none',
            'surface': 'ansi_default',
            'surface-style': 'none',
            'panel': 'ansi_default',
            'panel-style': 'none',
            'raised': 'ansi_default',
            'raised-style': 'none',
            'hover': 'ansi_default',
            'hover-style': 'none',
            'selection': 'ansi_default',
            'selection-style': 'reverse',
            'fg': 'ansi_default',
            'fg-style': 'none',
            'fg-strong': 'ansi_default',
            'fg-strong-style': 'bold',
            'fg-muted': 'ansi_default',
            'fg-muted-style': 'dim',
            'fg-faint': 'ansi_default',
            'fg-faint-style': 'dim',
            'line': 'ansi_default',
            'line-style': 'dim',
            'line-strong': 'ansi_default',
            'line-strong-style': 'dim',
            'line-control': 'ansi_default',
            'line-control-style': 'none',
            'focus': 'ansi_default',
            'focus-style': 'bold',
            'brand': 'ansi_blue',
            'brand-style': 'none',
            'fill-brand': 'ansi_blue',
            'fill-brand-style': 'bold',
            'on-fill-brand': 'ansi_bright_white',
            'on-fill-brand-style': 'bold',
            'status-working': 'ansi_blue',
            'status-working-style': 'none',
            'status-waiting': 'ansi_yellow',
            'status-waiting-style': 'bold',
            'status-waiting-fill': 'ansi_yellow',
            'status-waiting-fill-style': 'bold',
            'on-status-waiting-fill': 'ansi_black',
            'on-status-waiting-fill-style': 'bold',
            'status-idle': 'ansi_default',
            'status-idle-style': 'dim',
            'status-stale': 'ansi_magenta',
            'status-stale-style': 'none',
            'status-error': 'ansi_red',
            'status-error-style': 'bold',
            'status-stopped': 'ansi_default',
            'status-stopped-style': 'dim',
            'mode-default': 'ansi_default',
            'mode-default-style': 'none',
            'mode-plan': 'ansi_green',
            'mode-plan-style': 'none',
            'mode-edits': 'ansi_magenta',
            'mode-edits-style': 'none',
            'mode-auto': 'ansi_magenta',
            'mode-auto-style': 'bold',
            'on-mode-auto': 'ansi_bright_white',
            'on-mode-auto-style': 'bold',
            'mode-bypass': 'ansi_red',
            'mode-bypass-style': 'bold',
            'on-mode-bypass': 'ansi_bright_white',
            'on-mode-bypass-style': 'bold',
            'mode-dontask': 'ansi_cyan',
            'mode-dontask-style': 'none',
            'msg-prompt': 'ansi_default',
            'msg-prompt-style': 'bold',
            'msg-slash': 'ansi_default',
            'msg-slash-style': 'bold',
            'msg-tool': 'ansi_blue',
            'msg-tool-style': 'none',
            'msg-question': 'ansi_yellow',
            'msg-question-style': 'none',
            'msg-answer': 'ansi_green',
            'msg-answer-style': 'none',
            'msg-denied': 'ansi_red',
            'msg-denied-style': 'none',
            'msg-sent': 'ansi_cyan',
            'msg-sent-style': 'none',
            'msg-received': 'ansi_cyan',
            'msg-received-style': 'none',
            'msg-subagent': 'ansi_cyan',
            'msg-subagent-style': 'none',
            'msg-reply': 'ansi_default',
            'msg-reply-style': 'none',
            'res-normal': 'ansi_default',
            'res-normal-style': 'none',
            'res-warning': 'ansi_yellow',
            'res-warning-style': 'none',
            'res-critical': 'ansi_red',
            'res-critical-style': 'bold',
            'res-critical-fill': 'ansi_red',
            'res-critical-fill-style': 'bold',
            'on-res-critical-fill': 'ansi_bright_white',
            'on-res-critical-fill-style': 'bold',
            'res-track': 'ansi_default',
            'res-track-style': 'dim',
            'kind-managed': 'ansi_default',
            'kind-managed-style': 'bold',
            'kind-external': 'ansi_cyan',
            'kind-external-style': 'none',
            'edge': 'ansi_cyan',
            'edge-style': 'none',
            'edge-subagent': 'ansi_default',
            'edge-subagent-style': 'dim',
            'block-cursor-background': 'ansi_default',
            'block-cursor-foreground': 'ansi_default',
            'block-cursor-blurred-background': 'ansi_default',
            'block-cursor-blurred-foreground': 'ansi_default',
            'border': 'ansi_default',
            'border-blurred': 'ansi_default',
            'footer-background': 'ansi_default',
            'footer-foreground': 'ansi_default',
            'footer-key-foreground': 'ansi_default',
            'footer-description-foreground': 'ansi_default',
            'input-selection-background': 'ansi_default',
            'input-cursor-background': 'ansi_default',
            'input-cursor-foreground': 'ansi_default',
            'scrollbar': 'ansi_default',
            'scrollbar-hover': 'ansi_default',
            'scrollbar-active': 'ansi_default',
            'scrollbar-background': 'ansi_default',
            'scrollbar-background-hover': 'ansi_default',
            'scrollbar-background-active': 'ansi_default',
            'scrollbar-corner-color': 'ansi_default',
            'link-color': 'ansi_default',
            'link-color-hover': 'ansi_default',
            'link-background-hover': 'ansi_default',
            'screen-selection-background': 'ansi_default',
            'screen-selection-foreground': 'ansi_default',
            'text-muted': 'ansi_default',
            'text-disabled': 'ansi_default',
            'ansi-background': 'ansi_default',
            'ansi-foreground': 'ansi_default',
            'block-cursor-text-style': 'bold reverse',
            'block-cursor-blurred-text-style': 'none',
            'input-cursor-text-style': 'reverse',
            'link-style': 'underline',
            'link-style-hover': 'bold underline',
            'button-focus-text-style': 'bold reverse',
        },
    ),
}

GLYPHS: dict = {
    "status": {
        "working": {
            "unicode": "●",
            "ascii": "*",
            "nerd": "",
            "label": "working"
        },
        "waiting": {
            "unicode": "?",
            "ascii": "?",
            "nerd": "",
            "label": "needs you"
        },
        "idle": {
            "unicode": "○",
            "ascii": "o",
            "nerd": "",
            "label": "idle"
        },
        "stale": {
            "unicode": "◌",
            "ascii": "~",
            "nerd": "",
            "label": "stale"
        },
        "error": {
            "unicode": "×",
            "ascii": "x",
            "nerd": "",
            "label": "error"
        },
        "stopped": {
            "unicode": "■",
            "ascii": "#",
            "nerd": "",
            "label": "stopped"
        }
    },
    "spinner": {
        "unicode": [
            "▖",
            "▘",
            "▝",
            "▗"
        ],
        "ascii": [
            "-",
            "\\",
            "|",
            "/"
        ],
        "interval_ms": 120
    },
    "kind": {
        "managed": {
            "unicode": "◆",
            "ascii": "+",
            "nerd": "",
            "label": "managed"
        },
        "external": {
            "unicode": "◇",
            "ascii": ":",
            "nerd": "",
            "label": "ext"
        }
    },
    "mode": {
        "default": {
            "unicode": "·",
            "ascii": ".",
            "nerd": "",
            "label": "default"
        },
        "plan": {
            "unicode": "‖",
            "ascii": "=",
            "nerd": "",
            "label": "plan"
        },
        "acceptEdits": {
            "unicode": "±",
            "ascii": "+",
            "nerd": "",
            "label": "edits"
        },
        "auto": {
            "unicode": "»",
            "ascii": ">",
            "nerd": "",
            "label": "auto"
        },
        "bypassPermissions": {
            "unicode": "!",
            "ascii": "!",
            "nerd": "",
            "label": "BYPASS"
        },
        "dontAsk": {
            "unicode": "∅",
            "ascii": "0",
            "nerd": "",
            "label": "no-ask"
        }
    },
    "message": {
        "project": {
            "unicode": "⌂",
            "ascii": "=",
            "nerd": "",
            "label": "project"
        },
        "prompt": {
            "unicode": "›",
            "ascii": "$",
            "nerd": "",
            "label": "prompt"
        },
        "slash": {
            "unicode": "/",
            "ascii": "/",
            "nerd": "/",
            "label": "command"
        },
        "tool": {
            "unicode": "λ",
            "ascii": "&",
            "nerd": "",
            "label": "tool"
        },
        "question": {
            "unicode": "?",
            "ascii": "?",
            "nerd": "",
            "label": "asked"
        },
        "answer": {
            "unicode": "✓",
            "ascii": "v",
            "nerd": "",
            "label": "answered"
        },
        "denied": {
            "unicode": "×",
            "ascii": "x",
            "nerd": "",
            "label": "denied"
        },
        "sent": {
            "unicode": "→",
            "ascii": ">",
            "nerd": "",
            "label": "sent"
        },
        "received": {
            "unicode": "←",
            "ascii": "<",
            "nerd": "",
            "label": "received"
        },
        "subagent_started": {
            "unicode": "◦",
            "ascii": "+",
            "nerd": "",
            "label": "subagent"
        },
        "subagent_reported": {
            "unicode": "↑",
            "ascii": "^",
            "nerd": "",
            "label": "reported"
        },
        "reply": {
            "unicode": "¶",
            "ascii": "\"",
            "nerd": "",
            "label": "reply"
        }
    },
    "alert": {
        "normal": {
            "unicode": "·",
            "ascii": ".",
            "nerd": "",
            "label": "ok"
        },
        "warning": {
            "unicode": "△",
            "ascii": "^",
            "nerd": "",
            "label": "warn"
        },
        "critical": {
            "unicode": "▲",
            "ascii": "!",
            "nerd": "",
            "label": "CRIT"
        }
    },
    "tree": {
        "collapsed": {
            "unicode": "▸",
            "ascii": "+"
        },
        "expanded": {
            "unicode": "▾",
            "ascii": "-"
        },
        "branch": {
            "unicode": "├─",
            "ascii": "|-"
        },
        "last": {
            "unicode": "└─",
            "ascii": "`-"
        },
        "pipe": {
            "unicode": "│ ",
            "ascii": "| "
        },
        "cursor": {
            "unicode": "▌",
            "ascii": ">"
        }
    },
    "graph": {
        "edge_light": {
            "unicode": "─",
            "ascii": "-",
            "label": "1–2 messages"
        },
        "edge_heavy": {
            "unicode": "━",
            "ascii": "=",
            "label": "3–9 messages"
        },
        "edge_double": {
            "unicode": "═",
            "ascii": "#",
            "label": "10+ messages"
        },
        "lane_light": {
            "unicode": "│",
            "ascii": "|"
        },
        "lane_heavy": {
            "unicode": "┃",
            "ascii": "|"
        },
        "lane_double": {
            "unicode": "║",
            "ascii": "H"
        },
        "arrow_in": {
            "unicode": "◂",
            "ascii": "<"
        },
        "arrow_out": {
            "unicode": "▸",
            "ascii": ">"
        },
        "corner": {
            "unicode": "╭╮╰╯",
            "ascii": "++++"
        },
        "dashed": {
            "unicode": "┄┆",
            "ascii": "-:"
        },
        "subagent": {
            "unicode": "└◦",
            "ascii": "`+"
        }
    },
    "meter": {
        "bar": {
            "unicode": [
                "▏",
                "▎",
                "▍",
                "▌",
                "▋",
                "▊",
                "▉",
                "█"
            ],
            "ascii": [
                "#"
            ],
            "track": {
                "unicode": " ",
                "ascii": "-"
            },
            "caps": {
                "unicode": "▕▏",
                "ascii": "[]"
            }
        },
        "spark": {
            "unicode": [
                "▁",
                "▂",
                "▃",
                "▄",
                "▅",
                "▆",
                "▇",
                "█"
            ],
            "ascii": [
                "_",
                ".",
                "-",
                "-",
                "=",
                "=",
                "#",
                "#"
            ]
        }
    },
    "misc": {
        "branch": {
            "unicode": "@",
            "ascii": "@",
            "nerd": ""
        },
        "separator": {
            "unicode": "│",
            "ascii": "|"
        },
        "ellipsis": {
            "unicode": "…",
            "ascii": "~"
        },
        "radio_on": {
            "unicode": "(●)",
            "ascii": "(*)"
        },
        "radio_off": {
            "unicode": "( )",
            "ascii": "( )"
        },
        "check_on": {
            "unicode": "[x]",
            "ascii": "[x]"
        },
        "check_off": {
            "unicode": "[ ]",
            "ascii": "[ ]"
        },
        "image": {
            "unicode": "▣",
            "ascii": "[img]",
            "nerd": ""
        },
        "mcp": {
            "unicode": "mcp",
            "ascii": "mcp",
            "nerd": ""
        }
    }
}

# Text attributes the 16-color theme adds to a token (truecolor themes add none).
ANSI_STYLES: dict[str, str] = {
    "selection": "reverse",
    "fg-strong": "bold",
    "fg-muted": "dim",
    "fg-faint": "dim",
    "line": "dim",
    "line-strong": "dim",
    "focus": "bold",
    "fill-brand": "bold",
    "on-fill-brand": "bold",
    "status-waiting": "bold",
    "status-waiting-fill": "bold",
    "on-status-waiting-fill": "bold",
    "status-idle": "dim",
    "status-error": "bold",
    "status-stopped": "dim",
    "mode-auto": "bold",
    "on-mode-auto": "bold",
    "mode-bypass": "bold",
    "on-mode-bypass": "bold",
    "msg-prompt": "bold",
    "msg-slash": "bold",
    "res-critical": "bold",
    "res-critical-fill": "bold",
    "on-res-critical-fill": "bold",
    "res-track": "dim",
    "kind-managed": "bold",
    "edge-subagent": "dim"
}
# Fill tokens and the token for text drawn on them.
FILLS: dict[str, str] = {
    "fill-brand": "on-fill-brand",
    "status-waiting-fill": "on-status-waiting-fill",
    "mode-auto": "on-mode-auto",
    "mode-bypass": "on-mode-bypass",
    "res-critical-fill": "on-res-critical-fill"
}


def register_themes(app: App) -> None:
    """Register every Constellation theme on the app."""
    for theme in THEMES.values():
        app.register_theme(theme)


def variable_defaults() -> dict[str, str]:
    """Defaults for Constellation's custom variables, so constellation.tcss parses under any theme.
    Return this from App.get_theme_variable_defaults()."""
    return dict(THEMES["constellation-dark"].variables)


class ConstellationApp(App):
    """Base app: registers the themes, picks the right one for the terminal, loads constellation.tcss.

    The theme is chosen in __init__ (not on_mount, which Textual also calls on every base class)."""

    CSS_PATH = "constellation.tcss"
    THEME_VARIANT = "dark"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        register_themes(self)
        apply_theme(self, self.THEME_VARIANT)

    def get_theme_variable_defaults(self) -> dict[str, str]:
        return {**super().get_theme_variable_defaults(), **variable_defaults()}


def color_depth(app: App) -> str:
    """'truecolor', '256' or '16' — from CONSTELLATION_COLOR, else what Rich detected for this terminal."""
    forced = os.environ.get("CONSTELLATION_COLOR", "").strip().lower()
    if forced in ("truecolor", "256", "16"):
        return forced
    system = app.console.color_system or "standard"
    return {"truecolor": "truecolor", "256": "256"}.get(system, "16")


def theme_name(variant: str = "dark", depth: str = "truecolor") -> str:
    if depth == "16":
        return "constellation-ansi"
    return f"constellation-{variant}" + ("-256" if depth == "256" else "")


def apply_theme(app: App, variant: str = "dark") -> str:
    """Pick and apply the theme for this terminal. Returns the theme name."""
    name = theme_name(variant, color_depth(app))
    app.theme = name
    return name


def glyph_tier() -> str:
    forced = os.environ.get("CONSTELLATION_GLYPHS", "").strip().lower()
    if forced in ("unicode", "ascii", "nerd"):
        return forced
    encoding = (locale.getpreferredencoding(False) or "").lower().replace("-", "")
    return "unicode" if "utf8" in encoding else "ascii"


def glyph(category: str, name: str, tier: str | None = None) -> str:
    """glyph('status', 'waiting') -> '?'; falls back nerd -> unicode -> ascii."""
    entry = GLYPHS[category][name]
    tier = tier or glyph_tier()
    if tier == "nerd" and "nerd" in entry:
        return entry["nerd"]
    if tier in ("unicode", "nerd"):
        return entry["unicode"]
    return entry["ascii"]


def label(category: str, name: str) -> str:
    return GLYPHS[category][name].get("label", name)


def style(app: App, token: str, extra: str = "") -> str:
    """Content-markup style for a token: style(app, 'fg-muted') -> '$fg-muted' (truecolor) or '$fg-muted dim' (16 colors).

    Fill tokens come back as '<on> on <fill>', e.g. style(app, 'status-waiting-fill')."""
    ansi = bool(getattr(app.current_theme, "ansi", False))
    parts = [extra] if extra else []
    if token in FILLS:
        parts += ["bold", f"${FILLS[token]} on ${token}"]
    else:
        parts.append(f"${token}")
        if ansi and token in ANSI_STYLES:
            parts.append(ANSI_STYLES[token])
    return " ".join(p for p in parts if p)


def resolve(app: App, markup: str) -> str:
    """Replace $token references with concrete colors, for Rich-only APIs (Tree labels, Rich Text).

    Textual content markup resolves $variables itself; Rich markup does not."""
    import re

    variables = app.get_css_variables()

    def sub(m: "re.Match[str]") -> str:
        value = variables.get(m.group(1), "default").split()[0]
        return value[5:] if value.startswith("ansi_") else value

    return re.sub(r"\$([a-z][a-z0-9-]*)", sub, markup)


def chip(app: App, token: str, text: str) -> str:
    """A filled chip in content markup: chip(app, 'status-waiting-fill', '? needs you')."""
    return f"[{style(app, token)}] {text} [/]"

