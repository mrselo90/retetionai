# Security Incident Response Policy

Last updated: March 12, 2026

This document defines the minimum response process for suspected or confirmed security incidents affecting Recete Retention Agent.

## Objectives

- contain incidents quickly
- protect merchant and customer data
- preserve evidence needed for investigation
- restore service safely
- notify affected merchants when required

## Severity Model

- Low: no confirmed personal data exposure and limited operational impact
- Medium: credible security event requiring containment or credential rotation
- High: confirmed or likely exposure of personal data, production compromise, or material service disruption

## Response Steps

1. Detect and triage the event
2. Contain affected systems, credentials, or integrations
3. Assess impact, affected data, and affected merchants
4. Eradicate the root cause and apply remediation
5. Recover systems and verify safe operation
6. Notify affected merchants without undue delay when personal data impact is confirmed
7. Document the incident and follow-up actions

## Minimum Controls

- production logging and monitoring are used to investigate incidents
- access to sensitive systems is limited to authorized personnel
- credentials must be rotated when compromise is suspected
- backups and recovery procedures are part of incident recovery planning

## Ownership

The engineering/operations owner on duty is responsible for coordinating triage, containment, remediation, and merchant communication.
