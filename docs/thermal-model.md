# Speed target and full-load thermal simulation

The wheel calculator flags estimates above an editable target. The initial 6 ft/s is an example target, not a manufacturer, competition or universal safety limit. Values below the target do not establish safe driving. RPM is speed after the motor internal gearbox; the external drive ratios remain separate.

## Scope of the thermal chart

The chart projects a single representative motor temperature. The default motor-spec algorithm models a brushed DC motor at zero-speed stall, with temperature-dependent electrical losses. A separate manual mode accepts constant assumed per-motor heat loss at 100% modeled load. The manual-mode A/B example losses are 40 W and 50 W; these are invented educational parameters, not claims about a motor, robot or the submitted screenshots. Rated mechanical output watts, total drivetrain power, motor count and RPM cannot substitute for heat-loss data. The model is independent of wheel speed and does not infer heating from RPM. The 100% load scenario is a stalled motor, not full-speed travel.

The example threshold is 55 C. It is not a verified FTC cutoff, winding limit, housing limit, controller protection point or actual shutdown. The app does not command hardware or apply a cutoff. Curves continue as uninterrupted-heating projections after a threshold crossing. A run ending before the threshold is reached is explicitly reported as not reached within that duration; it is not labeled safe.

## Equation and units

C dT/dt = P - (T - Ta) / R

T(t) = Ta + P R + (T0 - Ta - P R) exp(-t / (R C))

P is heat loss in W, R thermal resistance in C/W, C thermal capacity in J/C and time is seconds. Manual mode uses the closed-form curve and analytic threshold crossing. The exported JSON includes all assumptions and marks the result as illustrative. At most 241 curve samples are generated per setup; the accessible table provides eleven evenly spaced readings. Both setups share starting temperature, ambient, thermal resistance and thermal capacity. Manual comparison varies heat loss; motor mode allows separate electrical parameters per setup.

The model does not infer mechanical load from wheel RPM. Multiple thermal nodes, winding/case lag, brush and iron losses, battery sag, real controller behavior and mounting changes are omitted. Real cutoff behavior requires the correct motor/controller documentation, temperature reference and identified thermal parameters. Do not validate this with a sustained stall-push test; follow manufacturer-approved, current-limited methods with adult/coach oversight.

All inputs and curves stay in tab memory unless the user downloads an export. No hardware, account data or hosted model service is contacted.

## Primary technical references

Reviewed November 2, 2026. These explain principles; they do not validate the example parameters or certify a team's motor.

- [REV motor definitions and specifications](https://docs.revrobotics.com/duo-build/motion/motors): free speed and stall torque/current describe different operating conditions.
- [maxon on motor heating](https://support.maxongroup.com/hc/en-us/articles/360004427413-On-the-heating-of-motors-in-hand-held-tools): losses, winding/housing differences and mounting affect temperature.
- [maxon motor winding protection](https://support.maxongroup.com/hc/en-us/articles/4412763373970-maxon-controllers-I2t-Limitation-Motor-winding-protection): actual controller overload protection depends on specified/configured motor parameters.
- [VEX V5 Smart Motor API](https://api.vex.com/v5/home/blocks/motion/smart_motor.html): its temperature/performance guidance is specific to that platform and is not an FTC cutoff specification.

## Motor electrical algorithm

The editable starting profiles are explicitly examples: both use 12 V datasheet voltage, 10 A stall current, 12 V applied voltage and a 0.0039/C resistance coefficient. A assumes a 5 A motor-current clamp and B a 7 A clamp. None is claimed to represent a named motor or actual controller setting.

Estimated terminal resistance at 25 C: R25 = datasheet voltage / datasheet stall current.

At each step: R(T) = R25 (1 + coefficient (T - 25)); I(T) = min(applied voltage / R(T), motor-current limit); heat(T) = I(T)^2 R(T).

The thermal differential equation is advanced with exact cooling for the heat held constant within each numerical step. Steps are bounded by 0.1 s, one twentieth of the thermal time constant, and a bound on temperature-dependent electrical feedback. Runs requiring over 200000 steps are rejected rather than silently undersampled. Threshold crossing is interpolated using the within-step exponential response. Exports record the electrical inputs, algorithm identifier, initial/final current and heat and integration count. There is no fixed equilibrium temperature returned for this varying-heat model.

This assumes a brushed DC motor, an approximately 25 C datasheet stall-current reference and ideal motor-side current limiting. A zero current limit models a disabled motor, not an unlimited controller. Supply voltage is not battery RMS current; PWM/controller dynamics are omitted. The resistance estimate also neglects brush voltage drops. Do not apply it blindly to smart/brushless motors or treat the selected temperature as their firmware shutdown setting. Enter the correct motor, controller and thermal data before interpreting the prediction.

The numerical method is checked against the exact constant-loss case when the temperature coefficient is zero, and against a halved time step with feedback enabled. Tests also verify lower current limits, reduced voltage, zero input power and invalid/stiff parameter sets.

Primary formula reference: [maxon motor thermal behavior formulas](https://www.maxongroup.com/medias/sys_master/8802918268958.pdf?attachment=true), including temperature-dependent resistance and Joule loss. The chosen coefficient and example parameters are editable model assumptions, not manufacturer ratings for FTC hardware.
