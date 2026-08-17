---
title: A sample research note
date: 2026-06-20
summary: How a post with a table of contents, side-notes, and a chart looks.
draft: false
---

This sample shows the three building blocks you'll use when writing: a table of
contents that builds itself from your section headings, footnotes that sit in
the right margin, and an embedded chart.[^intro]

[^intro]: This is a footnote. On a wide screen it appears out in the right
margin, level with the text that refers to it; on a phone it drops to the bottom
of the article. You write it in Markdown and it is numbered automatically.

## Introduction

Write normally. When you want a footnote, put a marker like this[^one] in the
text, and define the note anywhere below. The section heading above this
paragraph was automatically added to the Contents list at the top.

[^one]: Notes can hold whatever you like, including links and emphasis.

Notice that the opening words of this note are set in small capitals and the
first letter is a drop cap. Neither needed any markup — the site does both on
its own.

## An embedded chart

The figure below is drawn from `charts/sample-indicator.json`, exported straight
out of Python. The post itself contains one line, not a wall of generated
markup.[^chart]

[^chart]: Produced with `fig.write_json("charts/sample-indicator.json")`. Site
styling is applied automatically, so the Python needs no layout boilerplate.

{% chart "sample-indicator", "Figure 1. A sample indicator, 2021–2026. Replace with your own data." %}

## A second section

Because this is a third `##` heading, the Contents list above now has three
numbered entries. Add or remove headings and the table of contents updates by
itself the next time the site builds.
