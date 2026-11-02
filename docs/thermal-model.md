# Speed target and full-load thermal simulation

The wheel calculator flags estimates above an editable target. The initial 6 ft/s is an example target, not a manufacturer, competition or universal safety limit. Values below the target do not establish safe driving. RPM is speed after the motor internal gearbox; the external drive ratios remain separate.

## Scope of the thermal chart

The chart projects a single representative motor temperature with constant assumed per-motor heat loss at 100% modeled load. The A/B example losses are 40 W and 50 W; these are invented educational parameters, not claims about a motor, robot or the submitted screenshots. Rated mechanical output watts, total drivetrain power, motor count and RPM cannot substitute for heat-loss data. The model is independent of wheel speed and does not infer heating from RPM.

The example threshold is 55 C. It is not a verified FTC cutoff, winding limit, housing limit, controller protection point or actual shutdown. The app does not command hardware or apply a cutoff. Curves continue as uninterrupted-heating projections after a threshold crossing. A run ending before the threshold is reached is explicitly reported as not reached within that duration; it is not labeled safe.

## Equation and units

C dT/dt = P - (T - Ta) / R

T(t) = Ta + P R + (T0 - Ta - P R) exp(-t / (R C))

P is heat loss in W, R thermal resistance in C/W, C thermal capacity in J/C and time is seconds. The app uses the closed-form curve and analytic threshold crossing rather than a step-size-dependent cutoff time. The exported JSON includes all assumptions and marks the result as illustrative. At most 241 curve samples are generated per setup; the accessible table provides eleven evenly spaced readings. Both setups share starting temperature, ambient, resistance and capacity; comparison varies heat loss only.

No current or mechanical load model is inferred. Temperature-dependent resistance, multiple thermal nodes, winding/case lag, battery sag, current limiting, mounting and controller behavior are omitted. Real cutoff behavior requires the correct motor/controller documentation, temperature reference and identified thermal parameters. Do not validate this with a sustained stall-push test; follow manufacturer-approved, current-limited methods with adult/coach oversight.

All inputs and curves stay in tab memory unless the user downloads an export. No hardware, account data or hosted model service is contacted.

## Primary technical references

Reviewed November 2, 2026. These explain principles; they do not validate the example parameters or certify a team's motor.

- [REV motor definitions and specifications](https://docs.revrobotics.com/duo-build/motion/motors): free speed and stall torque/current describe different operating conditions.
- [maxon on motor heating](https://support.maxongroup.com/hc/en-us/articles/360004427413-On-the-heating-of-motors-in-hand-held-tools): losses, winding/housing differences and mounting affect temperature.
- [maxon motor winding protection](https://support.maxongroup.com/hc/en-us/articles/4412763373970-maxon-controllers-I2t-Limitation-Motor-winding-protection): actual controller overload protection depends on specified/configured motor parameters.
- [VEX V5 Smart Motor API](https://api.vex.com/v5/home/blocks/motion/smart_motor.html): its temperature/performance guidance is specific to that platform and is not an FTC cutoff specification.
